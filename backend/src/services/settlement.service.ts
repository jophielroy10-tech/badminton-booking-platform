import { Role, SettlementStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AUDIT_ACTIONS, createAuditLog } from "../utils/audit.js";
import { getPlatformSettings } from "../utils/platformSettings.js";

export function getMonthDateRange(month: number, year: number) {
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  return { startDate, endDate };
}

export function getLastDayOfMonth(month: number, year: number) {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

export function getDueWindowStart(month: number, year: number, dueWindowDays: number) {
  const dueDate = getLastDayOfMonth(month, year);
  const start = new Date(dueDate);
  start.setDate(dueDate.getDate() - dueWindowDays + 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function calculateOwnerMonthlyRevenue(ownerId: string, month: number, year: number) {
  const { startDate, endDate } = getMonthDateRange(month, year);
  const payments = await prisma.payment.findMany({
    where: {
      status: "SUCCESS",
      createdAt: { gte: startDate, lte: endDate },
      booking: {
        status: { in: ["CONFIRMED", "COMPLETED"] },
        court: { ownerId }
      }
    },
    select: { finalAmount: true }
  });
  return payments.reduce((sum, payment) => sum + Number(payment.finalAmount), 0);
}

export function buildUpiLink(input: { adminUpiId?: string | null; adminUpiName?: string | null; amountDue: number; month: number; year: number; ownerId: string }) {
  if (!input.adminUpiId) return null;
  const params = new URLSearchParams({
    pa: input.adminUpiId,
    pn: input.adminUpiName || "Platform Admin",
    am: input.amountDue.toFixed(2),
    cu: "INR",
    tn: `Commission-${input.month}-${input.year}-${input.ownerId}`
  });
  return `upi://pay?${params.toString()}`;
}

export async function getOrCreateOwnerSettlement(ownerId: string, month: number, year: number, force = false) {
  const settings = await getPlatformSettings();
  const dueDate = getLastDayOfMonth(month, year);
  const existing = await prisma.ownerMonthlySettlement.findUnique({ where: { ownerId_month_year: { ownerId, month, year } } });

  if (existing?.status === "VERIFIED" && !force) return existing;

  const monthlyRevenue = await calculateOwnerMonthlyRevenue(ownerId, month, year);
  const now = new Date();
  const isOverdue = now > dueDate && existing?.status !== "SUBMITTED" && existing?.status !== "VERIFIED";
  const commissionPercent = isOverdue ? settings.penaltyCommissionPercent : settings.commissionPercent;
  const amountDue = Math.round((monthlyRevenue * commissionPercent) / 100);
  const preservedStatus: SettlementStatus =
    existing?.status === "SUBMITTED" || existing?.status === "REJECTED"
      ? existing.status
      : isOverdue
        ? SettlementStatus.OVERDUE
        : SettlementStatus.PENDING;

  const data = {
    monthlyRevenue,
    commissionPercent,
    commissionAmount: Math.round((monthlyRevenue * settings.commissionPercent) / 100),
    penaltyApplied: isOverdue,
    amountDue,
    adminUpiIdSnapshot: settings.adminUpiId,
    dueDate,
    status: preservedStatus
  };

  const settlement = existing
    ? await prisma.ownerMonthlySettlement.update({ where: { id: existing.id }, data })
    : await prisma.ownerMonthlySettlement.create({ data: { ownerId, month, year, ...data } });

  if (isOverdue && existing?.status !== "OVERDUE") {
    await createAuditLog({
      userId: ownerId,
      action: AUDIT_ACTIONS.OWNER_COMMISSION_MARKED_OVERDUE,
      entity: "ownerMonthlySettlement",
      entityId: settlement.id,
      metadata: { ownerId, settlementId: settlement.id, month, year, amountDue, status: "OVERDUE" }
    });
  }

  return settlement;
}

export async function refreshAllOwnerSettlements(month: number, year: number, force = false) {
  const owners = await prisma.user.findMany({ where: { role: Role.OWNER, deletedAt: null }, select: { id: true } });
  const settlements = [];
  for (const owner of owners) {
    settlements.push(await getOrCreateOwnerSettlement(owner.id, month, year, force));
  }
  return settlements;
}

export async function courtWiseRevenue(ownerId: string, month: number, year: number) {
  const { startDate, endDate } = getMonthDateRange(month, year);
  const courts = await prisma.court.findMany({
    where: { ownerId },
    include: {
      bookings: {
        where: {
          status: { in: ["CONFIRMED", "COMPLETED"] },
          payment: { status: "SUCCESS", createdAt: { gte: startDate, lte: endDate } }
        },
        include: { payment: true, slot: true, court: { select: { id: true, name: true } } }
      }
    }
  });

  return courts.map((court) => ({
    courtId: court.id,
    courtName: court.name,
    revenue: court.bookings.reduce((sum, booking) => sum + (booking.payment ? Number(booking.payment.finalAmount) : 0), 0),
    bookings: court.bookings.length
  }));
}
