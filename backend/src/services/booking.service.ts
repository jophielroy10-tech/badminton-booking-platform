import { CourtStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.middleware.js";

const HOLD_TTL_MS = 10 * 60 * 1000;

function overlappingSlotWhere(courtId: string, startTime: Date, endTime: Date) {
  return {
    courtId,
    startTime: { lt: endTime },
    endTime: { gt: startTime }
  };
}

async function ensureCourtCanBeBooked(courtId: string) {
  const court = await prisma.court.findUnique({ where: { id: courtId } });
  if (!court) throw new AppError("Court not found", 404);
  if (!court.isApproved || court.status === CourtStatus.INACTIVE || court.status === CourtStatus.MAINTENANCE) {
    throw new AppError("This court is temporarily unavailable", 400);
  }
  return court;
}

async function findAvailableSlot(courtId: string, startTime: Date, endTime: Date) {
  const slot = await prisma.slot.findFirst({
    where: {
      ...overlappingSlotWhere(courtId, startTime, endTime),
      status: "AVAILABLE"
    },
    include: { court: true }
  });

  if (!slot) throw new AppError("Court is already booked for this time slot", 409);
  return slot;
}

async function ensureNoActiveBooking(slotId: string) {
  const activeBooking = await prisma.booking.findFirst({
    where: {
      slotId,
      status: { in: ["PENDING", "PENDING_PAYMENT", "CONFIRMED", "COMPLETED"] }
    }
  });

  if (activeBooking) throw new AppError("Court is already booked for this time slot", 409);
}

export const createBookingHold = async (userId: string, courtId: string, startTime: Date, endTime: Date) => {
  const court = await ensureCourtCanBeBooked(courtId);
  const slot = await findAvailableSlot(courtId, startTime, endTime);
  await ensureNoActiveBooking(slot.id);

  const expiresAt = new Date(Date.now() + HOLD_TTL_MS);

  return prisma.$transaction(async (tx) => {
    await tx.slot.update({
      where: { id: slot.id },
      data: { status: "HOLD", lockedBy: userId, lockedUntil: expiresAt }
    });

    return tx.booking.create({
      data: {
        userId,
        courtId,
        slotId: slot.id,
        status: "PENDING",
        expiresAt,
        idempotencyKey: `${userId}_${slot.id}_${Date.now()}`
      },
      include: { court: true, slot: true, payment: true }
    });
  }).then((booking) => ({
    ...booking,
    startTime,
    endTime,
    amount: slot.price,
    expiresAt,
    court
  }));
};

export const confirmBooking = async (userId: string, bookingId: string, paymentId: string) => {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: { court: true, slot: true, payment: true }
  });

  if (!booking) throw new AppError("Booking hold not found", 404);
  if (booking.expiresAt && booking.expiresAt <= new Date()) {
    await prisma.$transaction([
      prisma.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED" } }),
      prisma.slot.update({ where: { id: booking.slotId }, data: { status: "AVAILABLE", lockedBy: null, lockedUntil: null } })
    ]);
    throw new AppError("Booking hold has expired", 400);
  }

  await ensureCourtCanBeBooked(booking.courtId);

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId, bookingId: booking.id, status: "SUCCESS" }
  });
  if (!payment) throw new AppError("Successful payment is required before booking confirmation", 400);

  const confirmedConflict = await prisma.booking.findFirst({
    where: {
      slotId: booking.slotId,
      id: { not: booking.id },
      status: "CONFIRMED"
    }
  });
  if (confirmedConflict) throw new AppError("Court is already booked for this time slot", 409);

  return prisma.$transaction(async (tx) => {
    const confirmedBooking = await tx.booking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED" },
      include: { court: true, slot: true, payment: true }
    });

    await tx.slot.update({
      where: { id: booking.slotId },
      data: { status: "BOOKED", lockedBy: null, lockedUntil: null }
    });

    await tx.notification.create({
      data: {
        user: { connect: { id: userId } },
        title: "Booking confirmed",
        message: `Your booking at ${booking.court.name} is confirmed.`,
        type: "BOOKING_CONFIRMED"
      }
    });

    return confirmedBooking;
  });
};
