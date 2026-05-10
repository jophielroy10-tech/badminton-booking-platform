import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { AUDIT_ACTIONS, createAuditLog } from "../utils/audit.js";

let jobStarted = false;

export async function releaseExpiredPendingBookings(now = new Date()) {
  const expired = await prisma.booking.findMany({
    where: { status: { in: ["PENDING", "PENDING_PAYMENT"] }, expiresAt: { lte: now } },
    include: { payment: true }
  });

  for (const booking of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED" } });

      if (booking.payment?.status === "PENDING") {
        await tx.payment.update({ where: { id: booking.payment.id }, data: { status: "EXPIRED" } });
      }

      const activeBookingForSlot = await tx.booking.findFirst({
        where: {
          slotId: booking.slotId,
          id: { not: booking.id },
          OR: [
            { status: { in: ["CONFIRMED", "COMPLETED"] } },
            {
              status: { in: ["PENDING", "PENDING_PAYMENT"] },
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
            }
          ]
        },
        select: { id: true }
      });

      if (!activeBookingForSlot) {
        await tx.slot.update({
          where: { id: booking.slotId },
          data: { status: "AVAILABLE", lockedBy: null, lockedUntil: null }
        });
      }

      await tx.auditLog.create({
        data: {
          userId: booking.userId,
          action: AUDIT_ACTIONS.BOOKING_EXPIRED,
          entity: "booking",
          entityId: booking.id
        }
      });
    });
  }

  await createAuditLog({
    action: AUDIT_ACTIONS.EXPIRED_HOLD_CLEANUP_RAN,
    entity: "system",
    metadata: { expiredCount: expired.length }
  });

  return expired.length;
}

export function startReleaseExpiredHoldsJob() {
  if (jobStarted) return;
  jobStarted = true;

  cron.schedule("* * * * *", async () => {
    try {
      await releaseExpiredPendingBookings();
    } catch (error) {
      console.error("Expired booking hold cleanup job failed:", error);
    }
  });

  console.log("Expired booking hold cleanup job started");
}
