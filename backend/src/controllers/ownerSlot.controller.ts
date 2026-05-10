import { Request, Response } from "express";
import { SlotStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.middleware.js";
import { releaseExpiredPendingBookings } from "../jobs/releaseExpiredHolds.job.js";
import { AUDIT_ACTIONS, createAuditLog } from "../utils/audit.js";
import { generateSlotsForCourtSchedule } from "../utils/slotGeneration.js";
import { normalizeCourtImages } from "../utils/imageUrl.js";

const durationValues = [30, 60, 90, 120] as const;
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:mm format");
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const generateSchema = z.object({
  date: dateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  durationMinutes: z.coerce.number().refine((value) => durationValues.includes(value as any), "Duration must be 30, 60, 90, or 120 minutes"),
  price: z.coerce.number().positive("Price must be positive").optional(),
  overwriteExisting: z.boolean().optional().default(false)
});

const bulkGenerateSchema = z.object({
  startDate: dateSchema,
  repeatDays: z.coerce.number().int().min(1).max(30),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7),
  startTime: timeSchema,
  endTime: timeSchema,
  durationMinutes: z.coerce.number().refine((value) => durationValues.includes(value as any), "Duration must be 30, 60, 90, or 120 minutes"),
  price: z.coerce.number().positive("Price must be positive").optional(),
  overwriteExisting: z.boolean().optional().default(false)
});

const daySchema = z.object({
  date: dateSchema,
  reason: z.string().trim().min(2).max(120).optional()
});

const blockSlotsSchema = z.object({
  slotIds: z.array(z.string().uuid()).min(1, "Select at least one slot"),
  reason: z.string().trim().min(2, "Reason is required").max(120)
});

const updateSlotSchema = z.object({
  price: z.coerce.number().positive("Price must be positive").optional(),
  status: z.enum(["AVAILABLE", "BLOCKED"]).optional(),
  reason: z.string().trim().max(120).nullable().optional()
});

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (Number.isNaN(date.getTime())) throw new AppError("Valid date is required", 400);
  return date;
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDateTime(dateValue: string, timeValue: string) {
  const date = parseDateOnly(dateValue);
  const [hours, minutes] = timeValue.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function dateRange(dateValue: string) {
  const start = parseDateOnly(dateValue);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

function assertNotTooFarPast(date: Date) {
  const yesterday = new Date();
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date < yesterday) throw new AppError("Date cannot be in the past", 400);
}

async function ownerCourt(ownerId: string, courtId: string) {
  const court = await prisma.court.findUnique({ where: { id: courtId }, include: { images: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } });
  if (!court) throw new AppError("Court not found", 404);
  if (court.ownerId !== ownerId) throw new AppError("You can manage only your own court slots", 403);
  if (court.deletedAt) throw new AppError("Deleted courts cannot be managed", 400);
  return court;
}

function isActiveHold(slot: { status: SlotStatus; lockedUntil: Date | null }) {
  return slot.status === "HOLD" && Boolean(slot.lockedUntil && slot.lockedUntil > new Date());
}

function slotCounts(slots: Array<{ status: SlotStatus }>) {
  return {
    total: slots.length,
    available: slots.filter((slot) => slot.status === "AVAILABLE").length,
    booked: slots.filter((slot) => slot.status === "BOOKED").length,
    blocked: slots.filter((slot) => slot.status === "BLOCKED").length,
    hold: slots.filter((slot) => slot.status === "HOLD").length
  };
}

function buildSlots(input: z.infer<typeof generateSchema>) {
  const start = buildDateTime(input.date, input.startTime);
  const end = buildDateTime(input.date, input.endTime);
  assertNotTooFarPast(parseDateOnly(input.date));
  if (start >= end) throw new AppError("Start time must be before end time", 400);

  const slots: Array<{ date: Date; startTime: Date; endTime: Date }> = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const slotEnd = new Date(cursor.getTime() + input.durationMinutes * 60 * 1000);
    if (slotEnd > end) break;
    slots.push({ date: parseDateOnly(input.date), startTime: new Date(cursor), endTime: slotEnd });
    cursor = slotEnd;
  }
  if (slots.length === 0) throw new AppError("No slots fit in the selected time range", 400);
  return slots;
}

async function generateForDate(params: {
  courtId: string;
  price: number;
  input: z.infer<typeof generateSchema>;
}) {
  const slots = buildSlots(params.input);
  let createdCount = 0;
  let skippedCount = 0;

  for (const nextSlot of slots) {
    const overlaps = await prisma.slot.findMany({
      where: {
        courtId: params.courtId,
        startTime: { lt: nextSlot.endTime },
        endTime: { gt: nextSlot.startTime }
      }
    });

    const exact = overlaps.find((slot) => slot.startTime.getTime() === nextSlot.startTime.getTime() && slot.endTime.getTime() === nextSlot.endTime.getTime());
    const nonExactOverlap = overlaps.some((slot) => slot.id !== exact?.id);
    if (nonExactOverlap) {
      skippedCount += 1;
      continue;
    }

    if (exact) {
      if (!params.input.overwriteExisting) {
        skippedCount += 1;
        continue;
      }
      if (exact.status === "BOOKED" || isActiveHold(exact)) {
        skippedCount += 1;
        continue;
      }
      await prisma.slot.update({
        where: { id: exact.id },
        data: { price: params.price, status: "AVAILABLE", lockedBy: null, lockedUntil: null, reason: null }
      });
      createdCount += 1;
      continue;
    }

    await prisma.slot.create({
      data: {
        courtId: params.courtId,
        date: nextSlot.date,
        startTime: nextSlot.startTime,
        endTime: nextSlot.endTime,
        price: params.price,
        status: "AVAILABLE"
      }
    });
    createdCount += 1;
  }

  return { createdCount, skippedCount };
}

export const ownerSlotCourts = async (req: Request, res: Response) => {
  const today = formatDateOnly(new Date());
  const range = dateRange(today);
  const courts = await prisma.court.findMany({
    where: { ownerId: req.user!.id, deletedAt: null },
    include: {
      images: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      slots: { where: { startTime: { gte: range.start, lt: range.end } } }
    },
    orderBy: { createdAt: "desc" }
  });

  res.json({
    success: true,
    message: "Owner slot courts fetched successfully",
    data: courts.map((court) => {
      const { slots, ...courtData } = court;
      return { ...normalizeCourtImages(req, courtData), slotSummaryToday: slotCounts(slots) };
    })
  });
};

export const ownerCourtSlots = async (req: Request, res: Response) => {
  const court = await ownerCourt(req.user!.id, String(req.params.courtId));
  const date = typeof req.query.date === "string" ? req.query.date : formatDateOnly(new Date());
  dateSchema.parse(date);
  const range = dateRange(date);
  const slots = await prisma.slot.findMany({
    where: { courtId: court.id, startTime: { gte: range.start, lt: range.end } },
    orderBy: { startTime: "asc" }
  });
  res.json({ success: true, message: "Court slots fetched successfully", data: { court: normalizeCourtImages(req, court), date, slots, summary: slotCounts(slots) } });
};

export const generateOwnerSlots = async (req: Request, res: Response) => {
  const input = generateSchema.parse(req.body);
  const court = await ownerCourt(req.user!.id, String(req.params.courtId));
  const price = input.price ?? Number(court.pricePerHour);
  const result = await generateForDate({ courtId: court.id, price, input });

  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_GENERATED_SLOTS,
    entity: "slot",
    entityId: court.id,
    metadata: { courtId: court.id, ...input, price, ...result },
    req
  });

  res.status(201).json({ success: true, message: result.skippedCount ? "Slots generated successfully; some conflicts were skipped" : "Slots generated successfully", data: result });
};

export const generateOwnerSlotsBulk = async (req: Request, res: Response) => {
  const input = bulkGenerateSchema.parse(req.body);
  const court = await ownerCourt(req.user!.id, String(req.params.courtId));
  const price = input.price ?? Number(court.pricePerHour);
  let createdCount = 0;
  let skippedCount = 0;

  const startDate = parseDateOnly(input.startDate);
  assertNotTooFarPast(startDate);
  for (let index = 0; index < input.repeatDays; index += 1) {
    const current = new Date(startDate);
    current.setDate(startDate.getDate() + index);
    if (!input.weekdays.includes(current.getDay())) continue;
    const result = await generateForDate({
      courtId: court.id,
      price,
      input: { date: formatDateOnly(current), startTime: input.startTime, endTime: input.endTime, durationMinutes: input.durationMinutes, overwriteExisting: input.overwriteExisting, price }
    });
    createdCount += result.createdCount;
    skippedCount += result.skippedCount;
  }

  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_GENERATED_BULK_SLOTS,
    entity: "slot",
    entityId: court.id,
    metadata: { courtId: court.id, ...input, price, createdCount, skippedCount },
    req
  });

  res.status(201).json({ success: true, message: "Bulk slots generated successfully", data: { createdCount, skippedCount } });
};

export const generateOwnerSlotsFromSchedule = async (req: Request, res: Response) => {
  const court = await ownerCourt(req.user!.id, String(req.params.courtId));
  const result = await prisma.$transaction((tx) => generateSlotsForCourtSchedule(tx, court));
  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_GENERATED_SLOTS,
    entity: "slot",
    entityId: court.id,
    metadata: { courtId: court.id, source: "saved_schedule", ...result },
    req
  });
  res.status(201).json({ success: true, message: "Slots generated from saved schedule", data: result });
};

export const makeCourtUnavailableDay = async (req: Request, res: Response) => {
  const input = daySchema.required({ reason: true }).parse(req.body);
  const court = await ownerCourt(req.user!.id, String(req.params.courtId));
  await releaseExpiredPendingBookings();
  const range = dateRange(input.date);
  const slots = await prisma.slot.findMany({ where: { courtId: court.id, startTime: { gte: range.start, lt: range.end } } });
  const availableIds = slots.filter((slot) => slot.status === "AVAILABLE").map((slot) => slot.id);
  const skippedBookedCount = slots.filter((slot) => slot.status === "BOOKED").length;
  const skippedHoldCount = slots.filter((slot) => isActiveHold(slot)).length;

  const blocked = availableIds.length
    ? await prisma.slot.updateMany({ where: { id: { in: availableIds } }, data: { status: "BLOCKED", reason: input.reason, lockedBy: null, lockedUntil: null } })
    : { count: 0 };

  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_BLOCKED_DAY,
    entity: "slot",
    entityId: court.id,
    metadata: { courtId: court.id, date: input.date, reason: input.reason, blockedCount: blocked.count, skippedBookedCount, skippedHoldCount },
    req
  });

  res.json({ success: true, message: "Day unavailable slots updated", data: { blockedCount: blocked.count, skippedBookedCount, skippedHoldCount } });
};

export const makeCourtAvailableDay = async (req: Request, res: Response) => {
  const input = daySchema.pick({ date: true }).parse(req.body);
  const court = await ownerCourt(req.user!.id, String(req.params.courtId));
  const range = dateRange(input.date);
  const slots = await prisma.slot.findMany({ where: { courtId: court.id, status: "BLOCKED", startTime: { gte: range.start, lt: range.end } } });
  const allowedIds = slots
    .filter((slot) => {
      const reason = (slot.reason || "").toLowerCase();
      return reason.includes("owner") || reason.includes("unavailable") || reason.includes("maintenance") || reason.includes("holiday");
    })
    .map((slot) => slot.id);
  const updated = allowedIds.length ? await prisma.slot.updateMany({ where: { id: { in: allowedIds } }, data: { status: "AVAILABLE", reason: null } }) : { count: 0 };

  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_MADE_DAY_AVAILABLE,
    entity: "slot",
    entityId: court.id,
    metadata: { courtId: court.id, date: input.date, updatedCount: updated.count },
    req
  });

  res.json({ success: true, message: "Day made available", data: { updatedCount: updated.count } });
};

export const blockOwnerSlots = async (req: Request, res: Response) => {
  const input = blockSlotsSchema.parse(req.body);
  const court = await ownerCourt(req.user!.id, String(req.params.courtId));
  await releaseExpiredPendingBookings();
  const slots = await prisma.slot.findMany({ where: { id: { in: input.slotIds } } });
  if (slots.length !== input.slotIds.length || slots.some((slot) => slot.courtId !== court.id)) {
    throw new AppError("All selected slots must belong to your court", 403);
  }
  const blockableIds = slots.filter((slot) => slot.status === "AVAILABLE").map((slot) => slot.id);
  const blocked = blockableIds.length ? await prisma.slot.updateMany({ where: { id: { in: blockableIds } }, data: { status: "BLOCKED", reason: input.reason } }) : { count: 0 };

  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_BLOCKED_SLOTS,
    entity: "slot",
    entityId: court.id,
    metadata: { courtId: court.id, slotIds: input.slotIds, reason: input.reason, blockedCount: blocked.count, skippedCount: input.slotIds.length - blocked.count },
    req
  });

  res.json({ success: true, message: "Selected slots blocked", data: { blockedCount: blocked.count, skippedCount: input.slotIds.length - blocked.count } });
};

export const updateOwnerSlot = async (req: Request, res: Response) => {
  const input = updateSlotSchema.parse(req.body);
  const slot = await prisma.slot.findUnique({ where: { id: String(req.params.slotId) }, include: { court: true } });
  if (!slot) throw new AppError("Slot not found", 404);
  if (slot.court.ownerId !== req.user!.id) throw new AppError("You can update only your own court slots", 403);
  if (slot.status === "BOOKED") throw new AppError("Booked slots cannot be modified", 400);
  if (isActiveHold(slot)) throw new AppError("Active hold slots cannot be modified", 400);

  const data = await prisma.slot.update({
    where: { id: slot.id },
    data: {
      price: input.price,
      status: input.status,
      reason: input.status === "AVAILABLE" ? null : input.reason
    }
  });

  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_UPDATED_SLOT,
    entity: "slot",
    entityId: slot.id,
    metadata: { courtId: slot.courtId, price: input.price, status: input.status, reason: input.reason },
    req
  });

  res.json({ success: true, message: "Slot updated successfully", data });
};

export const deleteOwnerSlot = async (req: Request, res: Response) => {
  const slot = await prisma.slot.findUnique({ where: { id: String(req.params.slotId) }, include: { court: true } });
  if (!slot) throw new AppError("Slot not found", 404);
  if (slot.court.ownerId !== req.user!.id) throw new AppError("You can delete only your own court slots", 403);
  if (slot.status === "BOOKED") throw new AppError("Booked slots cannot be deleted", 400);
  if (isActiveHold(slot)) throw new AppError("Active hold slots cannot be deleted", 400);

  await prisma.slot.delete({ where: { id: slot.id } });
  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_DELETED_SLOT,
    entity: "slot",
    entityId: slot.id,
    metadata: { courtId: slot.courtId, date: formatDateOnly(slot.startTime), startTime: slot.startTime, endTime: slot.endTime },
    req
  });

  res.json({ success: true, message: "Slot deleted successfully", data: {} });
};
