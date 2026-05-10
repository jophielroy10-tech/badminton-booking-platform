import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.middleware.js";
import { createAuditLog, AUDIT_ACTIONS } from "../utils/audit.js";
import { calculateOwnerEarning, getPlatformSettings } from "../utils/platformSettings.js";
import { defaultSchedules } from "../utils/slotGeneration.js";
import { normalizeCourtImages, toPublicImageUrl, toPublicQrImageUrl } from "../utils/imageUrl.js";
import { mobileValidationMessage, normalizeIndianMobile } from "../validators/court.validator.js";
import { getUploadedFileUrl } from "../middleware/upload.middleware.js";

function uploadedCourtImageUrl(_req: Request, file: Express.Multer.File) {
  return getUploadedFileUrl(file, "court");
}

function uploadedUpiQrUrl(_req: Request, file: Express.Multer.File) {
  return getUploadedFileUrl(file, "qr");
}

function uploadedFiles(req: Request, field: string) {
  if (!req.files) return [];
  if (Array.isArray(req.files)) return field === "images" ? req.files : [];
  return (req.files[field] as Express.Multer.File[] | undefined) ?? [];
}

function uploadedAny(req: Request, fields: string[]) {
  return fields.flatMap((field) => uploadedFiles(req, field));
}

function normalizeUpiId(value: unknown) {
  const upiId = String(value || "").trim().toLowerCase();
  if (!upiId) throw new AppError("Owner UPI ID is required", 400);
  if (upiId.length < 5 || !upiId.includes("@")) throw new AppError("Valid owner UPI ID is required", 400);
  return upiId;
}

function normalizeContactMobile(value: unknown) {
  try {
    return normalizeIndianMobile(value);
  } catch {
    throw new AppError(mobileValidationMessage, 400);
  }
}

function mobileLast4(value?: string | null) {
  return value ? value.slice(-4) : null;
}

function parseCancellationChargePercent(value: unknown, defaultValue = 10) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new AppError("Cancellation charge must be between 0 and 100.", 400);
  }
  return percent;
}

function maskUpi(upiId?: string | null) {
  if (!upiId) return null;
  const [name, handle] = upiId.split("@");
  return `${name.slice(0, 2)}***@${handle || ""}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueCourtSlug(name: string) {
  const base = slugify(name) || "court";
  let slug = base;
  let index = 1;
  while (await prisma.court.findUnique({ where: { slug } })) {
    index += 1;
    slug = `${base}-${index}`;
  }
  return slug;
}

export const ownerDashboard = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayStart.getDate() + 1);

  const [totalCourts, activeCourts, totalBookings, revenue, todaySlots, pendingPaymentHolds] = await Promise.all([
    prisma.court.count({ where: { ownerId, deletedAt: null } }),
    prisma.court.count({ where: { ownerId, status: "ACTIVE", deletedAt: null } }),
    prisma.booking.count({ where: { court: { ownerId } } }),
    prisma.payment.aggregate({
      where: { booking: { court: { ownerId } }, status: "SUCCESS" },
      _sum: { finalAmount: true }
    }),
    prisma.slot.findMany({ where: { court: { ownerId }, startTime: { gte: todayStart, lt: todayEnd } }, select: { status: true } }),
    prisma.slot.count({ where: { court: { ownerId }, status: "HOLD", lockedUntil: { gt: new Date() } } })
  ]);

  res.json({
    success: true,
    message: "Owner dashboard fetched successfully",
    data: {
      totalCourts,
      activeCourts,
      totalBookings,
      totalRevenue: revenue._sum.finalAmount ?? 0,
      slotSummaryToday: {
        total: todaySlots.length,
        available: todaySlots.filter((slot) => slot.status === "AVAILABLE").length,
        booked: todaySlots.filter((slot) => slot.status === "BOOKED").length,
        blocked: todaySlots.filter((slot) => slot.status === "BLOCKED").length,
        hold: todaySlots.filter((slot) => slot.status === "HOLD").length,
        pendingPaymentHolds
      }
    }
  });
};

export const ownerCourts = async (req: Request, res: Response) => {
  const data = await prisma.court.findMany({
    where: { ownerId: req.user!.id, deletedAt: null },
    include: { images: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } },
    orderBy: { createdAt: "desc" }
  });
  res.json({
    success: true,
    message: "Owner courts fetched successfully",
    data: data.map((court) => normalizeCourtImages(req, court))
  });
};

export const createOwnerCourt = async (req: Request, res: Response) => {
  const { name, description, city, area, address, mapUrl, pricePerHour, type, hasAC, hasCoaching } = req.body;
  const contactMobile = normalizeContactMobile(req.body.contactMobile);
  const openingTime = String(req.body.openingTime || "09:00");
  const closingTime = String(req.body.closingTime || "21:00");
  const defaultScheduleEnabled = req.body.defaultScheduleEnabled === undefined ? true : req.body.defaultScheduleEnabled === "true" || req.body.defaultScheduleEnabled === true;
  const defaultSlotDurationMinutes = Number(req.body.defaultSlotDurationMinutes || req.body.slotDurationMinutes || 60);
  const slotGenerationDays = Number(req.body.slotGenerationDays || 7);
  const cancellationChargePercent = parseCancellationChargePercent(req.body.cancellationChargePercent, 10);
  const files = uploadedAny(req, ["images", "courtImages"]);
  const upiQrImage = uploadedAny(req, ["upiQrImage", "qrImage"])[0];

  if (!name || !description || !city || !area || !address || !pricePerHour) {
    throw new AppError("Court name, description, city, area, address and price are required", 400);
  }
  if (files.length === 0) throw new AppError("Please upload at least one court image.", 400);
  const upiId = normalizeUpiId(req.body.upiId);
  if (mapUrl && !/^https?:\/\/.+/i.test(String(mapUrl))) throw new AppError("Valid map URL is required", 400);
  const daysOpen = String(req.body.daysOpen || "0,1,2,3,4,5,6").split(",").map(Number).filter((value) => value >= 0 && value <= 6);

  const data = await prisma.court.create({
    data: {
      slug: await uniqueCourtSlug(name),
      name,
      description,
      city,
      area: area || null,
      address,
      contactMobile,
      mapUrl: mapUrl || null,
      pricePerHour: Number(pricePerHour),
      cancellationChargePercent,
      type: type === "OUTDOOR" ? "OUTDOOR" : "INDOOR",
      hasAC: hasAC === "true" || hasAC === true,
      hasCoaching: hasCoaching === "true" || hasCoaching === true,
      openingTime,
      closingTime,
      defaultScheduleEnabled,
      defaultSlotDurationMinutes,
      slotGenerationDays,
      ownerId: req.user!.id,
      status: "PENDING_APPROVAL",
      isApproved: false,
      upiId,
      upiQrImageUrl: upiQrImage ? uploadedUpiQrUrl(req, upiQrImage) : null,
      upiUpdatedAt: new Date(),
      upiUpdatedBy: req.user!.id,
      imageUrl: uploadedCourtImageUrl(req, files[0]),
      images: {
        create: files.map((file, index) => ({
          imageUrl: uploadedCourtImageUrl(req, file),
          isPrimary: index === 0
        }))
      },
      schedules: {
        create: defaultSchedules({ openingTime, closingTime, slotDurationMinutes: defaultSlotDurationMinutes, daysOpen })
      }
    },
    include: { images: true, schedules: true }
  });

  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_CREATED_COURT,
    entity: "court",
    entityId: data.id,
    metadata: { courtName: data.name, cancellationChargePercent },
    req
  });
  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_ADDED_COURT_UPI_DETAILS,
    entity: "court",
    entityId: data.id,
    metadata: { courtId: data.id, courtName: data.name, newUpiId: maskUpi(data.upiId), updatedBy: req.user!.id },
    req
  });
  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_ADDED_COURT_MOBILE,
    entity: "court",
    entityId: data.id,
    metadata: { courtId: data.id, ownerId: req.user!.id, mobileLast4: mobileLast4(data.contactMobile) },
    req
  });

  res.status(201).json({
    success: true,
    message: "Court submitted for admin approval",
    data: normalizeCourtImages(req, data)
  });
};

export const updateOwnerCourt = async (req: Request, res: Response) => {
  const courtId = String(req.params.id);
  const court = await prisma.court.findUnique({ where: { id: courtId } });
  if (!court) throw new AppError("Court not found", 404);
  if (court.deletedAt) throw new AppError("Deleted courts cannot be updated", 400);
  if (court.ownerId !== req.user!.id) throw new AppError("You can update only your own court", 403);

  const upiQrImage = uploadedAny(req, ["upiQrImage", "qrImage"])[0];
  const courtImageFiles = uploadedAny(req, ["images", "courtImages"]);
  const replacePrimaryImage = req.body.replacePrimaryImage === "true" || req.body.replacePrimaryImage === true;
  const nextUpiId = req.body.upiId !== undefined ? normalizeUpiId(req.body.upiId) : undefined;
  const nextContactMobile = normalizeContactMobile(req.body.contactMobile);
  const cancellationChargePercent = req.body.cancellationChargePercent !== undefined ? parseCancellationChargePercent(req.body.cancellationChargePercent, court.cancellationChargePercent ?? 10) : undefined;
  const cancellationChargeChanged = cancellationChargePercent !== undefined && cancellationChargePercent !== court.cancellationChargePercent;
  const upiChanged = nextUpiId !== undefined && nextUpiId !== court.upiId;
  const mobileChanged = nextContactMobile !== court.contactMobile;
  const qrChanged = Boolean(upiQrImage);
  if (req.body.mapUrl && !/^https?:\/\/.+/i.test(String(req.body.mapUrl))) throw new AppError("Valid map URL is required", 400);
  const upiQrUpdate = upiQrImage
    ? (() => {
        const qrUrl = uploadedUpiQrUrl(req, upiQrImage);
        if (!qrUrl) throw new AppError("QR image upload failed. Please upload JPG, PNG, or WEBP.", 400);
        return { upiQrImageUrl: qrUrl, upiUpdatedAt: new Date(), upiUpdatedBy: req.user!.id };
      })()
    : {};

  const data = await prisma.court.update({
    where: { id: court.id },
    data: {
      name: req.body.name,
      description: req.body.description,
      city: req.body.city,
      area: req.body.area || null,
      address: req.body.address,
      contactMobile: nextContactMobile,
      mapUrl: req.body.mapUrl !== undefined ? req.body.mapUrl || null : undefined,
      pricePerHour: req.body.pricePerHour ? Number(req.body.pricePerHour) : undefined,
      cancellationChargePercent,
      type: req.body.type,
      hasAC: req.body.hasAC,
      hasCoaching: req.body.hasCoaching,
      openingTime: req.body.openingTime,
      closingTime: req.body.closingTime,
      defaultScheduleEnabled: req.body.defaultScheduleEnabled !== undefined ? req.body.defaultScheduleEnabled === "true" || req.body.defaultScheduleEnabled === true : undefined,
      defaultSlotDurationMinutes: req.body.defaultSlotDurationMinutes ? Number(req.body.defaultSlotDurationMinutes) : undefined,
      slotGenerationDays: req.body.slotGenerationDays ? Number(req.body.slotGenerationDays) : undefined,
      status: "PENDING_APPROVAL",
      isApproved: false,
      rejectionReason: null,
      approvedAt: null,
      approvedBy: null,
      ...(nextUpiId !== undefined ? { upiId: nextUpiId, upiUpdatedAt: new Date(), upiUpdatedBy: req.user!.id } : {}),
      ...upiQrUpdate
    }
  });

  if (courtImageFiles.length > 0) {
    await prisma.$transaction(async (tx) => {
      const existingPrimary = await tx.courtImage.findFirst({ where: { courtId: court.id, isPrimary: true } });
      if (replacePrimaryImage) {
        await tx.courtImage.updateMany({ where: { courtId: court.id }, data: { isPrimary: false } });
      }
      const shouldPrimaryFirst = replacePrimaryImage || !existingPrimary;
      const imageCreateData = courtImageFiles.map((file, index) => {
        const imageUrl = uploadedCourtImageUrl(req, file);
        if (!imageUrl) throw new AppError("Court image upload failed. Please upload JPG, PNG, or WEBP.", 400);
        return {
          courtId: court.id,
          imageUrl,
          isPrimary: shouldPrimaryFirst && index === 0
        };
      });
      const created = await Promise.all(
        imageCreateData.map((data) =>
          tx.courtImage.create({
            data
          })
        )
      );
      if (replacePrimaryImage || !court.imageUrl || !existingPrimary) {
        await tx.court.update({ where: { id: court.id }, data: { imageUrl: created[0].imageUrl } });
      }
    });
  }

  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_UPDATED_COURT,
    entity: "court",
    entityId: data.id,
    metadata: { courtName: data.name, changedFields: Object.keys(req.body || {}) },
    req
  });
  if (upiChanged) {
    await createAuditLog({
      userId: req.user!.id,
      action: AUDIT_ACTIONS.OWNER_UPDATED_COURT_UPI_DETAILS,
      entity: "court",
      entityId: data.id,
      metadata: { courtId: data.id, courtName: data.name, oldUpiId: maskUpi(court.upiId), newUpiId: maskUpi(data.upiId), updatedBy: req.user!.id },
      req
    });
  }
  if (cancellationChargeChanged) {
    await createAuditLog({
      userId: req.user!.id,
      action: AUDIT_ACTIONS.OWNER_UPDATED_CANCELLATION_CHARGE,
      entity: "court",
      entityId: data.id,
      metadata: { courtId: data.id, previousPercent: court.cancellationChargePercent, nextPercent: cancellationChargePercent },
      req
    });
  }
  if (mobileChanged) {
    await createAuditLog({
      userId: req.user!.id,
      action: court.contactMobile ? AUDIT_ACTIONS.OWNER_UPDATED_COURT_MOBILE : AUDIT_ACTIONS.OWNER_ADDED_COURT_MOBILE,
      entity: "court",
      entityId: data.id,
      metadata: { courtId: data.id, ownerId: req.user!.id, mobileLast4: mobileLast4(data.contactMobile) },
      req
    });
  }
  if (qrChanged) {
    await createAuditLog({
      userId: req.user!.id,
      action: AUDIT_ACTIONS.OWNER_UPDATED_COURT_UPI_QR,
      entity: "court",
      entityId: data.id,
      metadata: { courtId: data.id, courtName: data.name, updatedBy: req.user!.id },
      req
    });
  }
  if (req.body.openingTime || req.body.closingTime || req.body.defaultSlotDurationMinutes || req.body.daysOpen) {
    const daysOpen = String(req.body.daysOpen || "0,1,2,3,4,5,6").split(",").map(Number).filter((value) => value >= 0 && value <= 6);
    await prisma.$transaction(async (tx) => {
      await tx.courtSchedule.deleteMany({ where: { courtId: court.id } });
      await tx.courtSchedule.createMany({
        data: defaultSchedules({
          openingTime: req.body.openingTime || data.openingTime || "09:00",
          closingTime: req.body.closingTime || data.closingTime || "21:00",
          slotDurationMinutes: Number(req.body.defaultSlotDurationMinutes || data.defaultSlotDurationMinutes || 60),
          daysOpen
        }).map((schedule) => ({ ...schedule, courtId: court.id }))
      });
    });
    await createAuditLog({ userId: req.user!.id, action: AUDIT_ACTIONS.OWNER_UPDATED_COURT_SCHEDULE, entity: "court", entityId: court.id, metadata: { courtId: court.id }, req });
  }

  const updated = await prisma.court.findUnique({
    where: { id: court.id },
    include: { images: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }, schedules: { orderBy: { dayOfWeek: "asc" } } }
  });
  res.json({ success: true, message: "Court updated and sent for review", data: updated ? normalizeCourtImages(req, updated) : normalizeCourtImages(req, data) });
};

export const uploadOwnerCourtImage = async (req: Request, res: Response) => {
  const courtId = String(req.params.courtId ?? req.params.id);
  const court = await prisma.court.findUnique({ where: { id: courtId } });
  if (!court) throw new AppError("Court not found", 404);
  if (court.deletedAt) throw new AppError("Deleted courts cannot be updated", 400);
  if (court.ownerId !== req.user!.id) throw new AppError("You can update only your own court", 403);
  const files = (req.files as Express.Multer.File[] | undefined) ?? (req.file ? [req.file] : []);
  if (files.length === 0) throw new AppError("Court image is required", 400);
  const existingCount = await prisma.courtImage.count({ where: { courtId: court.id } });

  const created = await prisma.$transaction(async (tx) => {
    const images = await Promise.all(
      files.map((file, index) =>
        tx.courtImage.create({
          data: {
            courtId: court.id,
            imageUrl: uploadedCourtImageUrl(req, file),
            isPrimary: existingCount === 0 && index === 0
          }
        })
      )
    );
    if (existingCount === 0 && images[0]) {
      await tx.court.update({ where: { id: court.id }, data: { imageUrl: images[0].imageUrl } });
    }
    return images;
  });

  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_UPLOADED_COURT_IMAGE,
    entity: "court",
    entityId: court.id,
    metadata: { courtId: court.id, courtName: court.name, imageCount: created.length },
    req
  });

  res.json({ success: true, message: "Court images uploaded successfully", data: created.map((image) => normalizeCourtImages(req, { images: [image] }).images[0]) });
};

export const ownerCourtById = async (req: Request, res: Response) => {
  const court = await prisma.court.findUnique({
    where: { id: String(req.params.id) },
    include: { images: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }, schedules: { orderBy: { dayOfWeek: "asc" } } }
  });
  if (!court) throw new AppError("Court not found", 404);
  if (court.ownerId !== req.user!.id) throw new AppError("You can view only your own court", 403);
  res.json({ success: true, message: "Owner court fetched successfully", data: normalizeCourtImages(req, court) });
};

export const deleteOwnerCourt = async (req: Request, res: Response) => {
  const court = await prisma.court.findUnique({ where: { id: String(req.params.id) } });
  if (!court) throw new AppError("Court not found", 404);
  if (court.ownerId !== req.user!.id) throw new AppError("You can delete only your own court", 403);
  const data = await prisma.court.update({ where: { id: court.id }, data: { deletedAt: new Date(), status: "INACTIVE", isApproved: false } });
  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_DELETED_COURT,
    entity: "court",
    entityId: court.id,
    metadata: { courtName: court.name },
    req
  });
  res.json({ success: true, message: "Court deleted successfully", data });
};

export const updateOwnerCourtStatus = async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!["INACTIVE", "MAINTENANCE"].includes(status)) throw new AppError("Owners can only set courts inactive or maintenance", 400);
  const court = await prisma.court.findUnique({ where: { id: String(req.params.id) } });
  if (!court) throw new AppError("Court not found", 404);
  if (court.deletedAt) throw new AppError("Deleted courts cannot be updated", 400);
  if (court.ownerId !== req.user!.id) throw new AppError("You can update only your own court", 403);
  const data = await prisma.court.update({ where: { id: court.id }, data: { status } });
  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_CHANGED_COURT_STATUS,
    entity: "court",
    entityId: court.id,
    metadata: { courtName: court.name, status },
    req
  });
  res.json({ success: true, message: "Court status updated successfully", data });
};

export const deleteOwnerCourtImage = async (req: Request, res: Response) => {
  const image = await prisma.courtImage.findUnique({ where: { id: String(req.params.imageId) }, include: { court: true } });
  if (!image) throw new AppError("Image not found", 404);
  if (image.court.ownerId !== req.user!.id) throw new AppError("You can delete only your own court images", 403);
  await prisma.courtImage.delete({ where: { id: image.id } });
  res.json({ success: true, message: "Court image deleted successfully", data: {} });
};

export const setPrimaryOwnerCourtImage = async (req: Request, res: Response) => {
  const image = await prisma.courtImage.findUnique({ where: { id: String(req.params.imageId) }, include: { court: true } });
  if (!image) throw new AppError("Image not found", 404);
  if (image.court.ownerId !== req.user!.id) throw new AppError("You can update only your own court images", 403);
  const data = await prisma.$transaction(async (tx) => {
    await tx.courtImage.updateMany({ where: { courtId: image.courtId }, data: { isPrimary: false } });
    const primary = await tx.courtImage.update({ where: { id: image.id }, data: { isPrimary: true } });
    await tx.court.update({ where: { id: image.courtId }, data: { imageUrl: image.imageUrl } });
    return primary;
  });
  res.json({ success: true, message: "Primary image updated successfully", data: { ...data, imageUrl: toPublicImageUrl(req, data.imageUrl) } });
};

export const ownerBookings = async (req: Request, res: Response) => {
  const data = await prisma.booking.findMany({
    where: { court: { ownerId: req.user!.id } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      court: true,
      slot: true,
      payment: { include: { refund: true } },
      refund: true
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({
    success: true,
    message: "Owner bookings fetched successfully",
    data
  });
  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_VIEWED_BOOKINGS,
    entity: "booking",
    metadata: { count: data.length },
    req
  });
};

function bookingAmount(booking: { payment: { status: string; finalAmount: any } | null }) {
  return booking.payment?.status === "SUCCESS" ? Number(booking.payment.finalAmount) : 0;
}

export const ownerUsers = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const bookings = await prisma.booking.findMany({
    where: { court: { ownerId } },
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true } },
      payment: true
    },
    orderBy: { createdAt: "desc" }
  });

  const users = new Map<string, any>();
  for (const booking of bookings) {
    const existing = users.get(booking.userId) ?? {
      id: booking.user.id,
      name: booking.user.name,
      email: booking.user.email,
      totalBookings: 0,
      totalAmountPaid: 0,
      lastBookingDate: null,
      confirmedBookings: 0,
      cancelledBookings: 0
    };
    existing.totalBookings += 1;
    existing.totalAmountPaid += bookingAmount(booking);
    existing.lastBookingDate = existing.lastBookingDate && existing.lastBookingDate > booking.createdAt ? existing.lastBookingDate : booking.createdAt;
    if (booking.status === "CONFIRMED") existing.confirmedBookings += 1;
    if (booking.status === "CANCELLED") existing.cancelledBookings += 1;
    users.set(booking.userId, existing);
  }

  res.json({ success: true, message: "Court users fetched successfully", data: Array.from(users.values()) });
};

export const ownerUserDetails = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const userId = String(req.params.id);

  const bookings = await prisma.booking.findMany({
    where: { userId, court: { ownerId } },
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true } },
      court: { select: { id: true, name: true } },
      slot: true,
      payment: true
    },
    orderBy: { createdAt: "desc" }
  });

  if (bookings.length === 0) throw new AppError("You do not have permission to view this user", 403);

  const totalAmountPaid = bookings.reduce((sum, booking) => sum + bookingAmount(booking), 0);
  const summary = {
    totalBookings: bookings.length,
    confirmedBookings: bookings.filter((booking) => booking.status === "CONFIRMED").length,
    cancelledBookings: bookings.filter((booking) => booking.status === "CANCELLED").length,
    completedBookings: bookings.filter((booking) => booking.status === "COMPLETED").length,
    totalAmountPaid,
    lastBookingDate: bookings[0]?.createdAt ?? null
  };

  res.json({
    success: true,
    message: "Court user details fetched successfully",
    data: {
      user: bookings[0].user,
      summary,
      bookings: bookings.map((booking) => ({
        id: booking.id,
        court: booking.court,
        slot: booking.slot,
        status: booking.status,
        paymentStatus: booking.payment?.status ?? null,
        finalAmount: booking.payment ? Number(booking.payment.finalAmount) : 0,
        checkedIn: booking.checkedIn,
        checkedInAt: booking.checkedInAt,
        createdAt: booking.createdAt
      }))
    }
  });
};

export const checkInUser = async (req: Request, res: Response) => {
  const { bookingId, otp, qrToken } = req.body;

  if (!bookingId || (!otp && !qrToken)) {
    throw new AppError("Booking ID and either OTP or QR token are required", 400);
  }

  const ownerId = req.user!.id;

  // Find booking
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { court: true, slot: true },
  });

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  // Verify booking belongs to owner's court
  if (booking.court.ownerId !== ownerId) {
    throw new AppError("Unauthorized access to booking", 403);
  }

  // Verify booking is confirmed and not already checked in
  if (booking.status !== "CONFIRMED") {
    throw new AppError("Booking is not confirmed", 400);
  }

  if (booking.checkedIn) {
    throw new AppError("User already checked in", 400);
  }

  // Verify OTP or QR token
  let isValid = false;
  if (otp && booking.checkInOtp === otp) {
    isValid = true;
  } else if (qrToken && booking.qrToken === qrToken) {
    isValid = true;
  }

  if (!isValid) {
    throw new AppError("Invalid OTP or QR token", 400);
  }

  // Check if slot time is valid (allow check-in 15 minutes before to 1 hour after)
  const now = new Date();
  const slotStart = booking.slot.startTime;
  const checkInWindowStart = new Date(slotStart.getTime() - 15 * 60 * 1000); // 15 min before
  const checkInWindowEnd = new Date(slotStart.getTime() + 60 * 60 * 1000); // 1 hour after

  if (now < checkInWindowStart || now > checkInWindowEnd) {
    throw new AppError("Check-in is not allowed at this time", 400);
  }

  // Update booking
  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      checkedIn: true,
      checkedInAt: now,
    },
    include: { user: true, court: true, slot: true },
  });

  // Create audit log
  await createAuditLog({
    userId: ownerId,
    action: AUDIT_ACTIONS.OWNER_CHECKED_IN_USER,
    entity: "booking",
    entityId: bookingId,
    metadata: { method: otp ? "otp" : "qr" },
    req
  });

  res.json({
    success: true,
    message: "User checked in successfully",
    data: updatedBooking,
  });
};

export const ownerPayments = async (req: Request, res: Response) => {
  const payments = await prisma.payment.findMany({
    where: { provider: "DIRECT_UPI", booking: { court: { ownerId: req.user!.id } } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      booking: { include: { court: true, slot: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  res.json({
    success: true,
    message: "Owner payments fetched successfully",
    data: payments.map((payment) => ({
      ...payment,
      upiQrImageUrl: toPublicQrImageUrl(req, payment.upiQrImageUrl),
      booking: payment.booking ? { ...payment.booking, court: normalizeCourtImages(req, payment.booking.court) } : payment.booking
    }))
  });
};

export const ownerPlatformPaymentSettings = async (req: Request, res: Response) => {
  const settings = await getPlatformSettings();
  res.json({
    success: true,
    message: "Platform payment settings fetched successfully",
    data: {
      platformUpiId: settings.platformUpiId,
      platformQrImageUrl: toPublicQrImageUrl(req, settings.platformQrImageUrl),
      platformAccountName: settings.platformAccountName
    }
  });
};

export const verifyOwnerUpiPayment = async (req: Request, res: Response) => {
  const payment = await prisma.payment.findUnique({
    where: { id: String(req.params.id) },
    include: { booking: { include: { court: true, slot: true } } }
  });
  if (!payment || !payment.booking) throw new AppError("Payment not found", 404);
  if (payment.provider !== "DIRECT_UPI") throw new AppError("Only direct UPI payments can be verified here", 400);
  if (payment.booking.court.ownerId !== req.user!.id) throw new AppError("You can verify only payments for your courts", 403);
  if (payment.status !== "USER_SUBMITTED") throw new AppError("Payment is not submitted by user", 400);
  if (payment.booking.status !== "PENDING_PAYMENT") throw new AppError("Booking is not pending payment", 400);

  const checkInOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const qrToken = uuidv4();
  const ownerEarning = await calculateOwnerEarning(Number(payment.finalAmount), {
    platformFee: Number(payment.platformFee),
    gst: Number(payment.gst),
    paymentId: payment.id,
    courtId: payment.booking.courtId
  });

  const booking = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.booking.update({
      where: { id: payment.bookingId },
      data: { status: "CONFIRMED", checkInOtp, qrToken },
      include: { court: true, slot: true, payment: true, user: true }
    });
    await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS", ownerVerifiedAt: new Date() } });
    await tx.slot.update({ where: { id: payment.booking.slotId }, data: { status: "BOOKED", lockedBy: null, lockedUntil: null } });
    await tx.ownerEarning.upsert({
      where: { bookingId: payment.bookingId },
      update: { ...ownerEarning, courtId: payment.booking.courtId, paymentId: payment.id, status: "PENDING" },
      create: { ownerId: req.user!.id, courtId: payment.booking.courtId, bookingId: payment.bookingId, paymentId: payment.id, ...ownerEarning, status: "PENDING" }
    });
    return updatedBooking;
  });

  await Promise.all([
    createAuditLog({
      userId: req.user!.id,
      action: AUDIT_ACTIONS.OWNER_VERIFIED_DIRECT_PAYMENT,
      entity: "payment",
      entityId: payment.id,
      metadata: { bookingId: payment.bookingId, courtId: payment.booking.courtId, amount: Number(payment.finalAmount) },
      req
    }),
    createAuditLog({
      userId: payment.userId,
      action: AUDIT_ACTIONS.PAYMENT_VERIFIED,
      entity: "payment",
      entityId: payment.id,
      metadata: { provider: "DIRECT_UPI", source: "owner_verification" },
      req
    }),
    createAuditLog({
      userId: payment.userId,
      action: AUDIT_ACTIONS.BOOKING_CONFIRMED,
      entity: "booking",
      entityId: payment.bookingId,
      metadata: { provider: "DIRECT_UPI", source: "owner_verification" },
      req
    })
  ]);

  res.json({ success: true, message: "Payment verified and booking confirmed", data: booking });
};

export const rejectOwnerUpiPayment = async (req: Request, res: Response) => {
  const reason = String(req.body.reason || "").trim() || "Owner rejected payment";
  const payment = await prisma.payment.findUnique({
    where: { id: String(req.params.id) },
    include: { booking: { include: { court: true, slot: true } } }
  });
  if (!payment || !payment.booking) throw new AppError("Payment not found", 404);
  if (payment.provider !== "DIRECT_UPI") throw new AppError("Only direct UPI payments can be rejected here", 400);
  if (payment.booking.court.ownerId !== req.user!.id) throw new AppError("You can reject only payments for your courts", 403);
  if (!["PENDING", "USER_SUBMITTED"].includes(payment.status)) throw new AppError("Payment cannot be rejected now", 400);

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "OWNER_REJECTED", ownerRejectedAt: new Date(), ownerRejectionReason: reason }
    }),
    prisma.booking.update({ where: { id: payment.bookingId }, data: { status: "FAILED" } }),
    prisma.slot.update({ where: { id: payment.booking.slotId }, data: { status: "AVAILABLE", lockedBy: null, lockedUntil: null } })
  ]);

  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_REJECTED_DIRECT_PAYMENT,
    entity: "payment",
    entityId: payment.id,
    metadata: { bookingId: payment.bookingId, courtId: payment.booking.courtId, reason },
    req
  });

  res.json({ success: true, message: "Payment rejected and slot released", data: {} });
};
