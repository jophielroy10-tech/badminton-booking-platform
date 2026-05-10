import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.middleware.js";
import { AUDIT_ACTIONS, createAuditLog } from "../utils/audit.js";
import { buildUpiLink, courtWiseRevenue, getDueWindowStart, getOrCreateOwnerSettlement, refreshAllOwnerSettlements } from "../services/settlement.service.js";
import { getPlatformSettings } from "../utils/platformSettings.js";
import { toPublicQrImageUrl } from "../utils/imageUrl.js";

function currentMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function dayRange(value: string) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  date.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setDate(date.getDate() + 1);
  return { fromDate: date, toDate: end };
}

function monthRange(year: number, month: number) {
  return { fromDate: new Date(year, month - 1, 1, 0, 0, 0, 0), toDate: new Date(year, month, 1, 0, 0, 0, 0) };
}

function previousDayRange() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return dayRange(yesterday.toISOString().slice(0, 10));
}

function sumEarnings(items: Array<{ grossAmount: any; commission: any; platformFee: any; gst: any; netAmount: any }>) {
  return {
    grossAmount: items.reduce((sum, item) => sum + Number(item.grossAmount), 0),
    totalCommission: items.reduce((sum, item) => sum + Number(item.commission), 0),
    totalPlatformFee: items.reduce((sum, item) => sum + Number(item.platformFee), 0),
    totalGst: items.reduce((sum, item) => sum + Number(item.gst), 0),
    netAmount: items.reduce((sum, item) => sum + Number(item.netAmount), 0)
  };
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function maskUtr(value: string) {
  if (value.length <= 6) return "***";
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

function normalizeOwnerAdminUtr(value: unknown) {
  const utr = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{8,30}$/.test(utr)) {
    throw new AppError("UTR / transaction ID must be 8 to 30 alphanumeric characters.", 400);
  }
  return utr;
}

function settlementPayable(settlement: { totalCommission: any; totalPlatformFee: any; totalGst: any }) {
  return Number(settlement.totalCommission) + Number(settlement.totalPlatformFee) + Number(settlement.totalGst);
}

function ownerSettlementPayablePayload(req: Request, settlement: any, settings: any) {
  const totalPayableToAdmin = settlementPayable(settlement);
  const accountName = settings.platformAccountName || settings.adminUpiName || "Badminton Platform";
  const upiId = settings.platformUpiId || settings.adminUpiId;
  const settlementData = {
    id: settlement.id,
    settlementId: settlement.id,
    type: settlement.cycle,
    date: dateOnly(settlement.fromDate),
    fromDate: settlement.fromDate,
    toDate: settlement.toDate,
    grossAmount: Number(settlement.grossAmount),
    commissionAmount: Number(settlement.totalCommission),
    platformFee: Number(settlement.totalPlatformFee),
    gst: Number(settlement.totalGst),
    totalPayableToAdmin,
    status: settlement.ownerPaymentStatus,
    utrNumber: settlement.ownerPaymentUtr,
    submittedAt: settlement.ownerPaidAt,
    rejectionReason: settlement.ownerPaymentRejectionReason
  };
  return {
    platform: {
      upiId,
      accountName,
      qrImageUrl: toPublicQrImageUrl(req, settings.platformQrImageUrl)
    },
    settlement: settlementData,
    payable: settlementData,
    upiLink: upiId
      ? `upi://pay?${new URLSearchParams({
          pa: upiId,
          pn: accountName,
          am: totalPayableToAdmin.toFixed(2),
          cu: "INR",
          tn: settlement.id
        }).toString()}`
      : null
  };
}

type PayAdminType = "DAILY" | "MONTHLY" | "TOTAL_PENDING";

function getPayType(value: unknown): PayAdminType {
  const type = String(value || "DAILY").toUpperCase();
  if (type === "DAILY" || type === "MONTHLY" || type === "TOTAL_PENDING") return type;
  throw new AppError("Valid settlement payment type is required", 400);
}

function payableAmountFromEarnings(items: Array<{ commission: any; platformFee: any; gst: any }>) {
  return items.reduce((sum, item) => sum + Number(item.commission) + Number(item.platformFee) + Number(item.gst), 0);
}

function settlementStatusFor(input: { pendingAmount: number; paymentStatus?: string | null }) {
  if (input.paymentStatus === "SUBMITTED") return "SUBMITTED";
  if (input.paymentStatus === "VERIFIED") return "VERIFIED";
  if (input.paymentStatus === "REJECTED") return "REJECTED";
  return input.pendingAmount > 0 ? "PENDING" : "PAID";
}

function rangeForPayType(type: PayAdminType, query: any) {
  if (type === "DAILY") {
    const range = dayRange(String(query.date || new Date().toISOString().slice(0, 10)));
    return { ...range, labelDate: dateOnly(range.fromDate) };
  }
  if (type === "MONTHLY") {
    const month = Number(query.month || new Date().getMonth() + 1);
    const year = Number(query.year || new Date().getFullYear());
    if (month < 1 || month > 12 || !Number.isFinite(year)) throw new AppError("Valid month and year are required", 400);
    return { ...monthRange(year, month), month, year };
  }
  return { fromDate: new Date(0), toDate: new Date(), labelDate: "total-pending" };
}

function isLinkableUnpaidEarning(earning: any) {
  if (earning.status === "PAID") return false;
  if (!earning.settlement) return true;
  return earning.settlement.ownerPaymentStatus === "NOT_PAID" || earning.settlement.ownerPaymentStatus === "REJECTED";
}

async function getPayableEarnings(ownerId: string, type: PayAdminType, range: { fromDate: Date; toDate: Date }) {
  const earnings = await prisma.ownerEarning.findMany({
    where: {
      ownerId,
      status: { not: "PAID" },
      ...(type === "TOTAL_PENDING" ? { createdAt: { lt: range.toDate } } : { createdAt: { gte: range.fromDate, lt: range.toDate } })
    },
    include: { settlement: true },
    orderBy: { createdAt: "asc" }
  });
  return earnings.filter(isLinkableUnpaidEarning);
}

async function findLatestSettlementStatus(ownerId: string, type: PayAdminType, range: { fromDate: Date; toDate: Date }) {
  return prisma.ownerSettlement.findFirst({
    where: {
      ownerId,
      cycle: type,
      ...(type === "TOTAL_PENDING" ? {} : { fromDate: range.fromDate, toDate: range.toDate }),
      ownerPaymentStatus: { in: ["SUBMITTED", "VERIFIED", "REJECTED"] }
    },
    orderBy: { updatedAt: "desc" }
  });
}

async function getOrCreatePayableSettlement(ownerId: string, type: PayAdminType, query: any = {}, settlementId?: string) {
  if (settlementId) {
    const settlement = await prisma.ownerSettlement.findUnique({ where: { id: settlementId } });
    if (!settlement) throw new AppError("Settlement not found", 404);
    if (settlement.ownerId !== ownerId) throw new AppError("You can view only your own settlement.", 403);
    return settlement;
  }

  const range = rangeForPayType(type, query);
  const earnings = await getPayableEarnings(ownerId, type, range);
  const totals = sumEarnings(earnings);
  const existing = await prisma.ownerSettlement.findFirst({
    where: {
      ownerId,
      cycle: type,
      ...(type === "TOTAL_PENDING" ? { ownerPaymentStatus: { in: ["NOT_PAID", "REJECTED"] } } : { fromDate: range.fromDate, toDate: range.toDate, ownerPaymentStatus: { in: ["NOT_PAID", "REJECTED"] } })
    },
    orderBy: { updatedAt: "desc" }
  });

  return prisma.$transaction(async (tx) => {
    const settlement = existing
      ? await tx.ownerSettlement.update({
          where: { id: existing.id },
          data: {
            fromDate: range.fromDate,
            toDate: range.toDate,
            ...totals,
            status: "PENDING",
            ownerPaymentStatus: existing.ownerPaymentStatus === "REJECTED" ? "REJECTED" : "NOT_PAID"
          }
        })
      : await tx.ownerSettlement.create({
          data: {
            ownerId,
            cycle: type,
            fromDate: range.fromDate,
            toDate: range.toDate,
            ...totals
          }
        });
    if (earnings.length > 0) {
      await tx.ownerEarning.updateMany({
        where: { id: { in: earnings.map((earning) => earning.id) } },
        data: { settlementId: settlement.id, status: "PENDING" }
      });
    }
    return settlement;
  });
}

async function createPayoutSettlements(input: { cycle: "DAILY" | "MONTHLY"; fromDate: Date; toDate: Date; ownerId?: string }) {
  const earnings = await prisma.ownerEarning.findMany({
    where: {
      status: "PENDING",
      settlementId: null,
      createdAt: { gte: input.fromDate, lt: input.toDate },
      ...(input.ownerId ? { ownerId: input.ownerId } : {})
    },
    orderBy: { createdAt: "asc" }
  });
  const byOwner = new Map<string, typeof earnings>();
  for (const earning of earnings) {
    byOwner.set(earning.ownerId, [...(byOwner.get(earning.ownerId) ?? []), earning]);
  }

  const settlements = [];
  for (const [ownerId, ownerEarnings] of byOwner) {
    const totals = sumEarnings(ownerEarnings);
    const settlement = await prisma.$transaction(async (tx) => {
      const created = await tx.ownerSettlement.create({
        data: {
          ownerId,
          cycle: input.cycle,
          fromDate: input.fromDate,
          toDate: input.toDate,
          ...totals
        },
        include: { owner: { select: { id: true, name: true, email: true } } }
      });
      await tx.ownerEarning.updateMany({
        where: { id: { in: ownerEarnings.map((earning) => earning.id) } },
        data: { settlementId: created.id, status: "PROCESSING" }
      });
      return created;
    });
    settlements.push(settlement);
  }
  return settlements;
}

async function settlementPayload(settlement: any, ownerId: string) {
  const settings = await getPlatformSettings();
  const dueWindowStart = getDueWindowStart(settlement.month, settlement.year, settings.commissionDueWindowDays);
  return {
    ...settlement,
    dueWindowStart,
    adminUpiId: settings.adminUpiId,
    adminUpiName: settings.adminUpiName,
    upiLink: buildUpiLink({
      adminUpiId: settings.adminUpiId,
      adminUpiName: settings.adminUpiName,
      amountDue: settlement.amountDue,
      month: settlement.month,
      year: settlement.year,
      ownerId
    }),
    message:
      settlement.status === "VERIFIED"
        ? "Commission paid and verified."
        : settlement.status === "SUBMITTED"
          ? "Payment submitted. Waiting for admin verification."
          : settlement.status === "OVERDUE"
            ? "Payment overdue. Penalty applied: 20% commission."
            : new Date() >= dueWindowStart
              ? "Pay before month end to keep commission at 15%."
              : "Commission payment opens during the last 5 days of the month."
  };
}

export const ownerCurrentSettlement = async (req: Request, res: Response) => {
  const { month, year } = currentMonthYear();
  const settlement = await getOrCreateOwnerSettlement(req.user!.id, month, year);
  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_VIEWED_MONTHLY_COMMISSION,
    entity: "ownerMonthlySettlement",
    entityId: settlement.id,
    metadata: { ownerId: req.user!.id, settlementId: settlement.id, month, year, amountDue: settlement.amountDue, status: settlement.status },
    req
  });
  res.json({ success: true, message: "Current settlement fetched successfully", data: await settlementPayload(settlement, req.user!.id) });
};

export const ownerSettlements = async (req: Request, res: Response) => {
  const where: any = { ownerId: req.user!.id };
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.cycle) where.cycle = String(req.query.cycle);
  if (req.query.from || req.query.to) {
    where.fromDate = {};
    if (req.query.from) where.fromDate.gte = new Date(String(req.query.from));
    if (req.query.to) where.fromDate.lte = new Date(String(req.query.to));
  }
  const items = await prisma.ownerSettlement.findMany({ where, orderBy: { createdAt: "desc" }, take: Number(req.query.limit || 100) });
  await createAuditLog({ userId: req.user!.id, action: AUDIT_ACTIONS.OWNER_VIEWED_SETTLEMENTS, entity: "ownerSettlement", metadata: { count: items.length }, req });
  res.json({ success: true, message: "Settlements fetched successfully", data: items });
};

export const ownerSettlementSummary = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const today = dayRange(new Date().toISOString().slice(0, 10));
  const yesterday = previousDayRange();
  const now = new Date();
  const monthNumber = now.getMonth() + 1;
  const year = now.getFullYear();
  const month = monthRange(year, monthNumber);
  const [earnings, recentEarnings, todaySettlement, monthSettlement, totalSettlement, recentPayments] = await Promise.all([
    prisma.ownerEarning.findMany({ where: { ownerId } }),
    prisma.ownerEarning.findMany({
      where: { ownerId },
      include: { court: { select: { id: true, name: true } }, booking: { select: { id: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 10
    }),
    findLatestSettlementStatus(ownerId, "DAILY", today),
    findLatestSettlementStatus(ownerId, "MONTHLY", month),
    findLatestSettlementStatus(ownerId, "TOTAL_PENDING", { fromDate: new Date(0), toDate: now }),
    prisma.ownerSettlement.findMany({
      where: { ownerId, ownerPaymentStatus: { in: ["SUBMITTED", "VERIFIED", "REJECTED"] } },
      orderBy: { updatedAt: "desc" },
      take: 10
    })
  ]);
  const paid = earnings.filter((earning) => earning.status === "PAID");
  const pending = earnings.filter((earning) => earning.status !== "PAID");
  const inRange = (from: Date, to: Date) => earnings.filter((item) => item.createdAt >= from && item.createdAt < to);
  const sum = (items: typeof earnings, field: "grossAmount" | "commission" | "netAmount" | "platformFee" | "gst") => items.reduce((total, item) => total + Number(item[field]), 0);
  const payable = (items: typeof earnings) => payableAmountFromEarnings(items);
  const settlementBlock = (items: typeof earnings, paymentStatus?: string | null, extra: Record<string, any> = {}) => {
    const paidItems = items.filter((item) => item.status === "PAID");
    const pendingItems = items.filter((item) => item.status !== "PAID");
    const pendingAmount = payable(pendingItems);
    return {
      grossAmount: sum(items, "grossAmount"),
      commissionAmount: sum(items, "commission"),
      platformFee: sum(items, "platformFee"),
      gst: sum(items, "gst"),
      totalPayable: payable(items),
      paidAmount: payable(paidItems),
      pendingAmount,
      status: settlementStatusFor({ pendingAmount, paymentStatus }),
      ...extra
    };
  };
  const todayItems = inRange(today.fromDate, today.toDate);
  const yesterdayItems = inRange(yesterday.fromDate, yesterday.toDate);
  const monthItems = inRange(month.fromDate, month.toDate);
  const daily = settlementBlock(todayItems, todaySettlement?.ownerPaymentStatus, { date: dateOnly(today.fromDate) });
  const monthly = settlementBlock(monthItems, monthSettlement?.ownerPaymentStatus, { month: monthNumber, year });
  const totalPendingItems = earnings.filter((item) => item.createdAt <= now);
  const totalPending = settlementBlock(totalPendingItems, totalSettlement?.ownerPaymentStatus);
  res.json({
    success: true,
    data: {
      daily,
      monthly,
      totalPending,
      recentPayments: recentPayments.map((item) => ({
        id: item.id,
        type: item.cycle,
        amount: settlementPayable(item),
        utrNumber: item.ownerPaymentUtr,
        status: item.ownerPaymentStatus,
        submittedAt: item.ownerPaidAt,
        paidAt: item.paidAt
      })),
      pendingAmount: payable(pending),
      paidAmount: payable(paid),
      todayGross: sum(todayItems, "grossAmount"),
      todayCommission: sum(todayItems, "commission"),
      todayPlatformFee: todayItems.reduce((total, item) => total + Number(item.platformFee), 0),
      todayGst: todayItems.reduce((total, item) => total + Number(item.gst), 0),
      todayPayableToAdmin: payable(todayItems),
      todayAdminPaymentStatus: todaySettlement?.ownerPaymentStatus ?? "NOT_PAID",
      todayAdminPaymentSettlementId: todaySettlement?.id ?? null,
      todayNet: sum(todayItems, "netAmount"),
      todayPending: daily.pendingAmount,
      todayPaid: daily.paidAmount,
      yesterdayNet: sum(yesterdayItems, "netAmount"),
      monthGross: sum(monthItems, "grossAmount"),
      monthCommission: sum(monthItems, "commission"),
      monthNet: sum(monthItems, "netAmount"),
      monthPending: monthly.pendingAmount,
      monthPaid: monthly.paidAmount,
      todayEarning: sum(todayItems, "netAmount"),
      thisMonthEarning: sum(monthItems, "netAmount"),
      totalCommission: earnings.reduce((sum, item) => sum + Number(item.commission), 0),
      totalGross: earnings.reduce((sum, item) => sum + Number(item.grossAmount), 0),
      recentEarnings
    }
  });
};

export const ownerPayToAdminDetails = async (req: Request, res: Response) => {
  const settings = await getPlatformSettings();
  if (!(settings.platformUpiId || settings.adminUpiId)) {
    throw new AppError("Admin UPI payment details are not configured yet.", 400);
  }

  const type = getPayType(req.query.type);
  const settlement = await getOrCreatePayableSettlement(req.user!.id, type, req.query, req.query.settlementId ? String(req.query.settlementId) : undefined);
  const data = ownerSettlementPayablePayload(req, settlement, settings);
  if (data.settlement.totalPayableToAdmin <= 0) {
    return res.json({ success: true, message: "No pending amount to pay.", data });
  }

  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_OPENED_PAY_TO_ADMIN_PAGE,
    entity: "ownerSettlement",
    entityId: settlement.id,
    metadata: { ownerId: req.user!.id, settlementId: settlement.id, type, amount: data.settlement.totalPayableToAdmin, date: data.settlement.date, status: data.settlement.status },
    req
  });

  res.json({ success: true, message: "Admin payment details fetched successfully", data });
};

export const ownerSubmitPayToAdminPayment = async (req: Request, res: Response) => {
  const type = getPayType(req.body.type);
  const settlement = await getOrCreatePayableSettlement(req.user!.id, type, req.body, req.body.settlementId ? String(req.body.settlementId) : undefined);
  if (settlement.ownerId !== req.user!.id) throw new AppError("You can submit only your own settlement payment.", 403);
  if (settlement.ownerPaymentStatus === "SUBMITTED") throw new AppError("Payment proof is already submitted and waiting for admin verification.", 400);
  if (settlement.ownerPaymentStatus === "VERIFIED") throw new AppError("This settlement payment is already verified.", 400);

  const expectedAmount = settlementPayable(settlement);
  if (expectedAmount <= 0) throw new AppError("There is no platform payable amount for this settlement.", 400);

  const utrNumber = normalizeOwnerAdminUtr(req.body.utrNumber);
  const [existingOwnerUtr, existingUserPaymentUtr] = await Promise.all([
    prisma.ownerSettlement.findFirst({ where: { ownerPaymentUtr: utrNumber, id: { not: settlement.id } }, select: { id: true } }),
    prisma.payment.findFirst({ where: { utrNumber }, select: { id: true } })
  ]);
  if (existingOwnerUtr || existingUserPaymentUtr) {
    throw new AppError("This UTR / transaction ID has already been used.", 409);
  }

  const data = await prisma.ownerSettlement.update({
    where: { id: settlement.id },
    data: {
      ownerPaymentUtr: utrNumber,
      ownerPaymentProofUrl: req.body.paymentProofUrl ? String(req.body.paymentProofUrl) : null,
      ownerPaymentStatus: "SUBMITTED",
      status: "SUBMITTED",
      ownerPaidAt: new Date(),
      ownerPaymentRejectionReason: null,
      ownerPaymentRejectedAt: null
    }
  });

  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_SUBMITTED_ADMIN_SETTLEMENT_PAYMENT,
    entity: "ownerSettlement",
    entityId: data.id,
    metadata: { ownerId: req.user!.id, settlementId: data.id, type: data.cycle, amount: expectedAmount, date: dateOnly(data.fromDate), utrNumber: maskUtr(utrNumber) },
    req
  });

  res.json({ success: true, message: "Payment proof submitted. Waiting for admin verification.", data });
};

export const ownerEarnings = async (req: Request, res: Response) => {
  const where: any = { ownerId: req.user!.id };
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.courtId) where.courtId = String(req.query.courtId);
  if (req.query.from || req.query.to) {
    where.createdAt = {};
    if (req.query.from) where.createdAt.gte = new Date(String(req.query.from));
    if (req.query.to) where.createdAt.lte = new Date(String(req.query.to));
  }
  const data = await prisma.ownerEarning.findMany({
    where,
    include: { court: { select: { id: true, name: true } }, booking: { select: { id: true, createdAt: true, status: true } }, payment: { select: { id: true, provider: true, utrNumber: true } } },
    orderBy: { createdAt: "desc" },
    take: Number(req.query.limit || 100)
  });
  res.json({ success: true, message: "Owner earnings fetched successfully", data });
};

export const ownerSubmitSettlementPayment = async (req: Request, res: Response) => {
  const settlement = await prisma.ownerMonthlySettlement.findUnique({ where: { id: String(req.params.id) } });
  if (!settlement) throw new AppError("Settlement not found", 404);
  if (settlement.ownerId !== req.user!.id) throw new AppError("You can submit only your own settlement", 403);
  if (!["PENDING", "REJECTED", "OVERDUE"].includes(settlement.status)) throw new AppError("Settlement cannot be submitted in its current state", 400);

  const paymentUtr = String(req.body.paymentUtr || "").trim();
  if (!paymentUtr) throw new AppError("Payment UTR is required", 400);

  const data = await prisma.ownerMonthlySettlement.update({
    where: { id: settlement.id },
    data: {
      paymentUtr,
      paymentProofUrl: req.body.paymentProofUrl ? String(req.body.paymentProofUrl) : null,
      status: "SUBMITTED",
      submittedAt: new Date(),
      rejectionReason: null,
      rejectedAt: null
    }
  });

  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.OWNER_SUBMITTED_MONTHLY_COMMISSION,
    entity: "ownerMonthlySettlement",
    entityId: data.id,
    metadata: { ownerId: req.user!.id, settlementId: data.id, month: data.month, year: data.year, amountDue: data.amountDue, status: data.status },
    req
  });

  res.json({ success: true, message: "Commission payment submitted for admin verification", data });
};

export const adminSettlementSummary = async (req: Request, res: Response) => {
  const today = dayRange(new Date().toISOString().slice(0, 10));
  const month = monthRange(new Date().getFullYear(), new Date().getMonth() + 1);
  const settlements = await prisma.ownerSettlement.findMany();
  const pending = settlements.filter((item) => item.status !== "PAID");
  const paid = settlements.filter((item) => item.status === "PAID");

  res.json({
    success: true,
    data: {
      totalPendingSettlement: pending.reduce((sum, item) => sum + Number(item.netAmount), 0),
      totalPaidSettlement: paid.reduce((sum, item) => sum + Number(item.netAmount), 0),
      todayPending: pending.filter((item) => item.fromDate >= today.fromDate && item.fromDate < today.toDate).reduce((sum, item) => sum + Number(item.netAmount), 0),
      thisMonthPending: pending.filter((item) => item.fromDate >= month.fromDate && item.fromDate < month.toDate).reduce((sum, item) => sum + Number(item.netAmount), 0),
      totalPendingCount: pending.length,
      totalPaidCount: paid.length
    }
  });
};

export const adminSettlements = async (req: Request, res: Response) => {
  const where: any = {};
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.ownerId) where.ownerId = String(req.query.ownerId);
  if (req.query.cycle) where.cycle = String(req.query.cycle);

  const data = await prisma.ownerSettlement.findMany({
    where,
    include: { owner: { select: { id: true, name: true, email: true } } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: Number(req.query.limit || 100)
  });
  await createAuditLog({ userId: req.user!.id, action: AUDIT_ACTIONS.ADMIN_VIEWED_OWNER_SETTLEMENTS, entity: "ownerSettlement", metadata: { count: data.length }, req });
  res.json({ success: true, message: "Settlements fetched successfully", data });
};

export const adminOwnerSettlementPayments = async (req: Request, res: Response) => {
  const cycle = req.query.cycle ? String(req.query.cycle).toUpperCase() : undefined;
  const paymentStatus = req.query.status ? String(req.query.status).toUpperCase() : undefined;
  const data = await prisma.ownerSettlement.findMany({
    where: {
      ownerPaymentStatus: paymentStatus && ["SUBMITTED", "VERIFIED", "REJECTED", "NOT_PAID"].includes(paymentStatus) ? paymentStatus as any : { in: ["SUBMITTED", "VERIFIED", "REJECTED"] },
      ...(cycle && ["DAILY", "MONTHLY", "TOTAL_PENDING", "MANUAL"].includes(cycle) ? { cycle: cycle as any } : {})
    },
    include: { owner: { select: { id: true, name: true, email: true } } },
    orderBy: { ownerPaidAt: "desc" }
  });

  res.json({
    success: true,
    message: "Owner payment submissions fetched successfully",
    data: data.map((settlement) => ({
      id: settlement.id,
      owner: settlement.owner,
      cycle: settlement.cycle,
      type: settlement.cycle,
      fromDate: settlement.fromDate,
      toDate: settlement.toDate,
      amount: settlementPayable(settlement),
      utrNumber: settlement.ownerPaymentUtr,
      submittedAt: settlement.ownerPaidAt,
      status: settlement.ownerPaymentStatus,
      grossAmount: settlement.grossAmount,
      commissionAmount: settlement.totalCommission,
      platformFee: settlement.totalPlatformFee,
      gst: settlement.totalGst
    }))
  });
};

export const adminVerifyOwnerSettlementPayment = async (req: Request, res: Response) => {
  if (req.body.action && req.body.action !== "VERIFY") throw new AppError("Invalid verification action", 400);
  const settlement = await prisma.ownerSettlement.findUnique({ where: { id: String(req.params.id) } });
  if (!settlement) throw new AppError("Settlement not found", 404);
  if (settlement.ownerPaymentStatus !== "SUBMITTED") throw new AppError("Only submitted owner payments can be verified", 400);

  const data = await prisma.$transaction(async (tx) => {
    const updated = await tx.ownerSettlement.update({
      where: { id: settlement.id },
      data: {
        ownerPaymentStatus: "VERIFIED",
        ownerPaymentVerifiedAt: new Date(),
        ownerPaymentVerifiedBy: req.user!.id,
        status: "PAID",
        paidAt: new Date(),
        paidBy: req.user!.id,
        settlementUtr: settlement.ownerPaymentUtr
      },
      include: { owner: { select: { id: true, name: true, email: true } } }
    });
    await tx.ownerEarning.updateMany({ where: { settlementId: settlement.id }, data: { status: "PAID" } });
    return updated;
  });

  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.ADMIN_VERIFIED_OWNER_SETTLEMENT_PAYMENT,
    entity: "ownerSettlement",
    entityId: data.id,
    metadata: { ownerId: data.ownerId, settlementId: data.id, amount: settlementPayable(data), date: dateOnly(data.fromDate), utrNumber: data.ownerPaymentUtr ? maskUtr(data.ownerPaymentUtr) : null },
    req
  });

  res.json({ success: true, message: "Owner settlement payment verified", data });
};

export const adminRejectOwnerSettlementPayment = async (req: Request, res: Response) => {
  const reason = String(req.body.reason || "").trim();
  if (!reason) throw new AppError("Rejection reason is required", 400);
  const settlement = await prisma.ownerSettlement.findUnique({ where: { id: String(req.params.id) } });
  if (!settlement) throw new AppError("Settlement not found", 404);
  if (settlement.ownerPaymentStatus !== "SUBMITTED") throw new AppError("Only submitted owner payments can be rejected", 400);

  const data = await prisma.ownerSettlement.update({
    where: { id: settlement.id },
    data: {
      ownerPaymentStatus: "REJECTED",
      ownerPaymentRejectionReason: reason,
      ownerPaymentRejectedAt: new Date(),
      status: "PENDING"
    },
    include: { owner: { select: { id: true, name: true, email: true } } }
  });
  await prisma.ownerEarning.updateMany({ where: { settlementId: settlement.id, status: { not: "PAID" } }, data: { status: "PENDING" } });

  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.ADMIN_REJECTED_OWNER_SETTLEMENT_PAYMENT,
    entity: "ownerSettlement",
    entityId: data.id,
    metadata: { ownerId: data.ownerId, settlementId: data.id, amount: settlementPayable(data), date: dateOnly(data.fromDate), reason },
    req
  });

  res.json({ success: true, message: "Owner settlement payment rejected", data });
};

export const adminGenerateDailySettlements = async (req: Request, res: Response) => {
  const range = dayRange(String(req.body.date || new Date().toISOString().slice(0, 10)));
  const data = await createPayoutSettlements({ cycle: "DAILY", ...range, ownerId: req.body.ownerId ? String(req.body.ownerId) : undefined });
  await createAuditLog({ userId: req.user!.id, action: AUDIT_ACTIONS.ADMIN_GENERATED_DAILY_SETTLEMENT, entity: "ownerSettlement", metadata: { date: req.body.date, count: data.length }, req });
  res.status(201).json({ success: true, message: "Daily settlements generated", data });
};

export const adminGenerateMonthlySettlements = async (req: Request, res: Response) => {
  const year = Number(req.body.year || new Date().getFullYear());
  const month = Number(req.body.month || new Date().getMonth() + 1);
  const data = await createPayoutSettlements({ cycle: "MONTHLY", ...monthRange(year, month), ownerId: req.body.ownerId ? String(req.body.ownerId) : undefined });
  await createAuditLog({ userId: req.user!.id, action: AUDIT_ACTIONS.ADMIN_GENERATED_MONTHLY_SETTLEMENT, entity: "ownerSettlement", metadata: { month, year, count: data.length }, req });
  res.status(201).json({ success: true, message: "Monthly settlements generated", data });
};

export const adminMarkSettlementPaid = async (req: Request, res: Response) => {
  const settlementUtr = String(req.body.settlementUtr || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6,40}$/.test(settlementUtr)) throw new AppError("Settlement UTR is required", 400);
  const settlement = await prisma.ownerSettlement.findUnique({ where: { id: String(req.params.id) } });
  if (!settlement) throw new AppError("Settlement not found", 404);
  const data = await prisma.$transaction(async (tx) => {
    const updated = await tx.ownerSettlement.update({
      where: { id: settlement.id },
      data: { status: "PAID", paidAt: new Date(), paidBy: req.user!.id, settlementUtr, note: req.body.note ? String(req.body.note) : null },
      include: { owner: { select: { id: true, name: true, email: true } } }
    });
    await tx.ownerEarning.updateMany({ where: { settlementId: settlement.id }, data: { status: "PAID" } });
    return updated;
  });
  await createAuditLog({ userId: req.user!.id, action: AUDIT_ACTIONS.ADMIN_MARKED_SETTLEMENT_PAID, entity: "ownerSettlement", entityId: settlement.id, metadata: { settlementUtr, netAmount: settlement.netAmount }, req });
  res.json({ success: true, message: "Settlement marked paid", data });
};

export const adminEarnings = async (req: Request, res: Response) => {
  const where: any = {};
  if (req.query.ownerId) where.ownerId = String(req.query.ownerId);
  if (req.query.courtId) where.courtId = String(req.query.courtId);
  if (req.query.status) where.status = String(req.query.status);
  const data = await prisma.ownerEarning.findMany({
    where,
    include: { owner: { select: { id: true, name: true, email: true } }, court: { select: { id: true, name: true } }, booking: { select: { id: true, createdAt: true, status: true } }, payment: { select: { id: true, provider: true, utrNumber: true } } },
    orderBy: { createdAt: "desc" },
    take: Number(req.query.limit || 200)
  });
  res.json({ success: true, message: "Owner earnings fetched successfully", data });
};

export const adminSettlementDetails = async (req: Request, res: Response) => {
  const settlement = await prisma.ownerMonthlySettlement.findUnique({
    where: { id: String(req.params.id) },
    include: { owner: { select: { id: true, name: true, email: true, status: true } } }
  });
  if (!settlement) throw new AppError("Settlement not found", 404);
  const [ownerCourts, courtBreakdown, payments] = await Promise.all([
    prisma.court.findMany({ where: { ownerId: settlement.ownerId }, select: { id: true, name: true, city: true, area: true, status: true } }),
    courtWiseRevenue(settlement.ownerId, settlement.month, settlement.year),
    prisma.payment.findMany({
      where: {
        status: "SUCCESS",
        booking: { status: { in: ["CONFIRMED", "COMPLETED"] }, court: { ownerId: settlement.ownerId } }
      },
      include: { booking: { include: { court: { select: { id: true, name: true } }, slot: true } } },
      orderBy: { createdAt: "desc" }
    })
  ]);
  res.json({ success: true, data: { settlement, owner: settlement.owner, ownerCourts, courtBreakdown, payments } });
};

export const adminVerifySettlement = async (req: Request, res: Response) => {
  const settlement = await prisma.ownerMonthlySettlement.findUnique({ where: { id: String(req.params.id) } });
  if (!settlement) throw new AppError("Settlement not found", 404);
  if (settlement.status !== "SUBMITTED") throw new AppError("Only submitted settlements can be verified", 400);
  const data = await prisma.ownerMonthlySettlement.update({
    where: { id: settlement.id },
    data: { status: "VERIFIED", verifiedAt: new Date(), verifiedBy: req.user!.id, amountPaid: settlement.amountDue }
  });
  await createAuditLog({ userId: req.user!.id, action: AUDIT_ACTIONS.ADMIN_VERIFIED_OWNER_COMMISSION, entity: "ownerMonthlySettlement", entityId: data.id, metadata: { ownerId: data.ownerId, settlementId: data.id, month: data.month, year: data.year, amountDue: data.amountDue, status: data.status }, req });
  res.json({ success: true, message: "Owner commission payment verified", data });
};

export const adminRejectSettlement = async (req: Request, res: Response) => {
  const reason = String(req.body.reason || "").trim();
  if (!reason) throw new AppError("Rejection reason is required", 400);
  const settlement = await prisma.ownerMonthlySettlement.findUnique({ where: { id: String(req.params.id) } });
  if (!settlement) throw new AppError("Settlement not found", 404);
  const data = await prisma.ownerMonthlySettlement.update({
    where: { id: settlement.id },
    data: { status: "REJECTED", rejectionReason: reason, rejectedAt: new Date() }
  });
  await createAuditLog({ userId: req.user!.id, action: AUDIT_ACTIONS.ADMIN_REJECTED_OWNER_COMMISSION, entity: "ownerMonthlySettlement", entityId: data.id, metadata: { ownerId: data.ownerId, settlementId: data.id, month: data.month, year: data.year, amountDue: data.amountDue, status: data.status }, req });
  res.json({ success: true, message: "Owner commission payment rejected", data });
};

export const adminRecalculateSettlements = async (req: Request, res: Response) => {
  const month = Number(req.body.month || currentMonthYear().month);
  const year = Number(req.body.year || currentMonthYear().year);
  const settlements = await refreshAllOwnerSettlements(month, year, Boolean(req.body.force));
  await createAuditLog({ userId: req.user!.id, action: AUDIT_ACTIONS.ADMIN_RECALCULATED_OWNER_SETTLEMENTS, entity: "ownerMonthlySettlement", metadata: { month, year, count: settlements.length }, req });
  res.json({ success: true, message: "Settlements recalculated", data: { count: settlements.length } });
};
