import { prisma } from "../lib/prisma.js";
import fs from "node:fs";
import path from "node:path";
import { AppError } from "../middleware/error.middleware.js";
import { AUDIT_ACTIONS, createAuditLog } from "../utils/audit.js";
import { CourtStatus, Prisma, Role, UserStatus } from "@prisma/client";
import { hashPassword } from "../utils/password.js";
import { adminCreateUserSchema, resetPasswordSchema } from "../validators/auth.validator.js";
import { getPlatformSettings } from "../utils/platformSettings.js";
import { courtWiseRevenue, getOrCreateOwnerSettlement } from "../services/settlement.service.js";
import { generateSlotsForCourtSchedule } from "../utils/slotGeneration.js";
import { normalizeCourtImages, toPublicImageUrl, toPublicQrImageUrl } from "../utils/imageUrl.js";
import { getUploadedFileUrl } from "../middleware/upload.middleware.js";

const ADMIN_ACCOUNT_LIMIT = 2;

const adminSafeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  isSuspended: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true
} as const;

function activeAdminWhere(excludeUserId?: string) {
  return {
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
    deletedAt: null,
    ...(excludeUserId ? { id: { not: excludeUserId } } : {})
  };
}

function adminCreateAction(role: Role) {
  if (role === Role.ADMIN) return AUDIT_ACTIONS.ADMIN_CREATED_ADMIN;
  if (role === Role.OWNER) return AUDIT_ACTIONS.ADMIN_CREATED_OWNER;
  return AUDIT_ACTIONS.ADMIN_CREATED_USER;
}

function adminDeleteAction(role: Role) {
  if (role === Role.ADMIN) return AUDIT_ACTIONS.ADMIN_DELETED_ADMIN;
  if (role === Role.OWNER) return AUDIT_ACTIONS.ADMIN_DELETED_OWNER;
  return AUDIT_ACTIONS.ADMIN_DELETED_USER;
}

function adminCreateMessage(role: Role) {
  if (role === Role.ADMIN) return "Admin account created successfully";
  if (role === Role.OWNER) return "Owner account created successfully";
  return "User account created successfully";
}

function uploadedUpiQrUrl(_req: any, file: Express.Multer.File) {
  return getUploadedFileUrl(file, "qr");
}

function normalizeUpiId(value: unknown) {
  const upiId = String(value || "").trim().toLowerCase();
  if (!upiId) throw new AppError("Owner UPI ID is required", 400);
  if (upiId.length < 5 || !upiId.includes("@")) throw new AppError("Valid owner UPI ID is required", 400);
  return upiId;
}

function maskUpi(upiId?: string | null) {
  if (!upiId) return null;
  const [name, handle] = upiId.split("@");
  return `${name.slice(0, 2)}***@${handle || ""}`;
}

function localUploadExists(value?: string | null) {
  if (!value) return false;
  let candidate = value;
  try {
    if (/^https?:\/\//i.test(candidate)) {
      candidate = new URL(candidate).pathname;
    }
  } catch {
    return false;
  }
  if (path.isAbsolute(candidate) && fs.existsSync(candidate)) return true;
  const normalized = candidate.replace(/\\/g, "/");
  const uploadIndex = normalized.indexOf("/uploads/");
  if (uploadIndex >= 0) {
    const relative = normalized.slice(uploadIndex + "/uploads/".length);
    return fs.existsSync(path.join(process.cwd(), "uploads", relative));
  }
  if (normalized.startsWith("uploads/")) {
    return fs.existsSync(path.join(process.cwd(), normalized));
  }
  if (normalized.startsWith("/uploads/")) {
    return fs.existsSync(path.join(process.cwd(), normalized.slice(1)));
  }
  return fs.existsSync(path.join(process.cwd(), "uploads", "courts", path.basename(normalized)));
}

function successfulAmount(payment: { status: string; finalAmount: any } | null | undefined) {
  return payment?.status === "SUCCESS" ? Number(payment.finalAmount) : 0;
}

function courtAnalytics(bookings: Array<{ status: string; payment: any; ownerEarning?: any }>) {
  return {
    totalBookings: bookings.length,
    successfulPayments: bookings.filter((booking) => booking.payment?.status === "SUCCESS").length,
    totalRevenue: bookings.reduce((sum, booking) => sum + successfulAmount(booking.payment), 0),
    pendingPayments: bookings.filter((booking) => booking.payment?.status === "PENDING").length,
    cancelledBookings: bookings.filter((booking) => booking.status === "CANCELLED").length,
    confirmedBookings: bookings.filter((booking) => booking.status === "CONFIRMED").length,
    completedBookings: bookings.filter((booking) => booking.status === "COMPLETED").length,
    refundedAmount: bookings.reduce((sum, booking) => sum + (booking.payment?.refund ? Number(booking.payment.refund.amount) : 0), 0),
    platformCommission: bookings.reduce((sum, booking) => sum + (booking.ownerEarning ? Number(booking.ownerEarning.commission) : 0), 0),
    ownerNetEarning: bookings.reduce((sum, booking) => sum + (booking.ownerEarning ? Number(booking.ownerEarning.netAmount) : 0), 0)
  };
}

export const adminDashboard = async (_req: any, res: any) => {
  const [users, owners, courts, bookings, revenue] = await Promise.all([
    prisma.user.count({ where: { role: "USER", deletedAt: null } }),
    prisma.user.count({ where: { role: "OWNER", deletedAt: null } }),
    prisma.court.count({ where: { deletedAt: null } }),
    prisma.booking.count(),
    prisma.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { finalAmount: true } })
  ]);

  res.json({
    success: true,
    message: "Admin dashboard fetched successfully",
    data: { users, owners, courts, bookings, revenue: revenue._sum.finalAmount ?? 0 }
  });
};

export const getAdminSettings = async (_req: any, res: any) => {
  const data = await getPlatformSettings();
  res.json({ success: true, message: "Platform settings fetched successfully", data: { ...data, platformQrImageUrl: toPublicQrImageUrl(_req, data.platformQrImageUrl) } });
};

export const updateAdminSettings = async (req: any, res: any) => {
  const adminUpiId = req.body.adminUpiId ? String(req.body.adminUpiId).trim() : null;
  const adminUpiName = req.body.adminUpiName ? String(req.body.adminUpiName).trim() : null;
  const commissionPercent = Number(req.body.commissionPercent);
  const penaltyCommissionPercent = Number(req.body.penaltyCommissionPercent);
  const commissionDueWindowDays = Number(req.body.commissionDueWindowDays);

  if (adminUpiId && !adminUpiId.includes("@")) throw new AppError("Valid UPI ID is required", 400);
  if (Number.isNaN(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) throw new AppError("Commission percent must be between 0 and 100", 400);
  if (Number.isNaN(penaltyCommissionPercent) || penaltyCommissionPercent < commissionPercent || penaltyCommissionPercent > 100) {
    throw new AppError("Penalty commission must be greater than or equal to normal commission", 400);
  }
  if (Number.isNaN(commissionDueWindowDays) || commissionDueWindowDays < 1 || commissionDueWindowDays > 15) throw new AppError("Due window days must be between 1 and 15", 400);

  const existing = await getPlatformSettings();
  const data = await prisma.platformSetting.update({
    where: { id: existing.id },
    data: { adminUpiId, adminUpiName, commissionPercent, penaltyCommissionPercent, commissionDueWindowDays }
  });
  res.json({ success: true, message: "Platform settings updated successfully", data: { ...data, platformQrImageUrl: toPublicQrImageUrl(req, data.platformQrImageUrl) } });
};

export const getAdminPaymentSettings = async (_req: any, res: any) => {
  const data = await getPlatformSettings();
  res.json({ success: true, message: "Payment settings fetched successfully", data: { ...data, platformQrImageUrl: toPublicQrImageUrl(_req, data.platformQrImageUrl) } });
};

export const updateAdminPaymentSettings = async (req: any, res: any) => {
  const existing = await getPlatformSettings();
  const platformUpiId = req.body.platformUpiId ? String(req.body.platformUpiId).trim().toLowerCase() : null;
  if (platformUpiId && !platformUpiId.includes("@")) throw new AppError("Valid platform UPI ID is required", 400);
  const data = await prisma.platformSetting.update({
    where: { id: existing.id },
    data: {
      platformUpiId,
      platformAccountName: req.body.platformAccountName ? String(req.body.platformAccountName).trim() : null
    }
  });
  res.json({ success: true, message: "Payment settings updated successfully", data: { ...data, platformQrImageUrl: toPublicQrImageUrl(req, data.platformQrImageUrl) } });
};

export const uploadAdminPaymentQr = async (req: any, res: any) => {
  const existing = await getPlatformSettings();
  if (!req.file) throw new AppError("QR image is required", 400);
  const data = await prisma.platformSetting.update({
    where: { id: existing.id },
    data: { platformQrImageUrl: uploadedUpiQrUrl(req, req.file) }
  });
  res.json({ success: true, message: "Platform QR uploaded", data: { ...data, platformQrImageUrl: toPublicQrImageUrl(req, data.platformQrImageUrl) } });
};

export const adminUsers = async (_req: any, res: any) => {
  const data = await prisma.user.findMany({
    select: { ...adminSafeUserSelect, walletBalance: true },
    orderBy: { createdAt: "desc" }
  });
  res.json({ success: true, message: "Users fetched successfully", data });
};

export const adminUserStats = async (_req: any, res: any) => {
  const [activeAdmins, totalUsers, totalOwners, totalAdmins] = await Promise.all([
    prisma.user.count({ where: activeAdminWhere() }),
    prisma.user.count({ where: { role: Role.USER, deletedAt: null } }),
    prisma.user.count({ where: { role: Role.OWNER, deletedAt: null } }),
    prisma.user.count({ where: activeAdminWhere() })
  ]);

  res.json({
    success: true,
    data: {
      activeAdmins,
      adminLimit: ADMIN_ACCOUNT_LIMIT,
      canCreateAdmin: activeAdmins < ADMIN_ACCOUNT_LIMIT,
      totalUsers,
      totalOwners,
      totalAdmins
    }
  });
};

export const createAdminUser = async (req: any, res: any) => {
  const input = adminCreateUserSchema.parse(req.body);
  const role = input.role as Role;

  const user = await prisma.$transaction(
    async (tx) => {
      const existingUser = await tx.user.findUnique({ where: { email: input.email } });
      if (existingUser) throw new AppError("Email is already registered", 409);

      const activeAdminCount = await tx.user.count({ where: activeAdminWhere() });
      if (role === Role.ADMIN && activeAdminCount >= ADMIN_ACCOUNT_LIMIT) {
        await createAuditLog({
          userId: req.user.id,
          action: AUDIT_ACTIONS.ADMIN_LIMIT_BLOCKED,
          entity: "USER",
          metadata: {
            targetUserId: null,
            targetEmail: input.email,
            targetRole: role,
            activeAdminCount
          },
          req
        });
        throw new AppError("Admin account limit reached. Only 2 admin accounts are allowed.", 400);
      }

      const created = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          password: await hashPassword(input.password),
          role,
          status: UserStatus.ACTIVE,
          isSuspended: false,
          deletedAt: null
        },
        select: adminSafeUserSelect
      });

      await createAuditLog({
        userId: req.user.id,
        action: adminCreateAction(role),
        entity: "USER",
        entityId: created.id,
        metadata: {
          targetUserId: created.id,
          targetEmail: created.email,
          targetRole: created.role,
          activeAdminCount: role === Role.ADMIN ? activeAdminCount + 1 : activeAdminCount
        },
        req
      });

      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  res.status(201).json({
    success: true,
    message: adminCreateMessage(role),
    data: user
  });
};

export const adminCourts = async (req: any, res: any) => {
  const status = req.query.status;
  const allowedStatuses = Object.values(CourtStatus);
  const where = typeof status === "string" && allowedStatuses.includes(status as CourtStatus) ? { status: status as CourtStatus } : {};
  const data = await prisma.court.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, email: true } },
      images: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      bookings: { include: { payment: true, ownerEarning: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({
    success: true,
    message: "Courts fetched successfully",
    data: data.map((court) => {
      const { bookings, ...courtData } = court;
      return { ...normalizeCourtImages(req, courtData), analytics: courtAnalytics(bookings) };
    })
  });
};

export const adminCourtDetails = async (req: any, res: any) => {
  const court = await prisma.court.findUnique({
    where: { id: String(req.params.id) },
    include: {
      owner: { select: { id: true, name: true, email: true, status: true } },
      images: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      bookings: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          slot: true,
          payment: { include: { refund: true } },
          ownerEarning: true
        },
        orderBy: { createdAt: "desc" }
      },
      slots: true
    }
  });

  if (!court) throw new AppError("Court not found", 404);
  await createAuditLog({
    userId: req.user.id,
    action: AUDIT_ACTIONS.ADMIN_VIEWED_COURT_CONTACT,
    entity: "court",
    entityId: court.id,
    metadata: { courtId: court.id, ownerId: court.ownerId, mobileLast4: court.contactMobile ? court.contactMobile.slice(-4) : null },
    req
  });
  const selectedMonth = Number(req.query.month || new Date().getMonth() + 1);
  const selectedYear = Number(req.query.year || new Date().getFullYear());
  const ownerSettlement = await getOrCreateOwnerSettlement(court.ownerId, selectedMonth, selectedYear);
  const courtBreakdown = await courtWiseRevenue(court.ownerId, selectedMonth, selectedYear);
  const thisCourtRevenue = courtBreakdown.find((item) => item.courtId === court.id)?.revenue ?? 0;
  const analytics = courtAnalytics(court.bookings);
  const users = new Map<string, any>();

  for (const booking of court.bookings) {
    const existing = users.get(booking.userId) ?? {
      id: booking.user.id,
      name: booking.user.name,
      email: booking.user.email,
      bookingCount: 0,
      totalPaid: 0,
      lastBookingDate: null
    };
    existing.bookingCount += 1;
    existing.totalPaid += successfulAmount(booking.payment);
    existing.lastBookingDate = existing.lastBookingDate && existing.lastBookingDate > booking.createdAt ? existing.lastBookingDate : booking.createdAt;
    users.set(booking.userId, existing);
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayStart.getDate() + 1);
  const slotOverview = {
    total: court.slots.length,
    available: court.slots.filter((slot) => slot.status === "AVAILABLE").length,
    booked: court.slots.filter((slot) => slot.status === "BOOKED").length,
    blocked: court.slots.filter((slot) => slot.status === "BLOCKED").length,
    hold: court.slots.filter((slot) => slot.status === "HOLD").length,
    todayAvailability: court.slots.filter((slot) => slot.startTime >= todayStart && slot.startTime < todayEnd && slot.status === "AVAILABLE").length
  };

  const { owner, images, bookings, slots: _slots, ...courtData } = court;
  res.json({
    success: true,
    message: "Court details fetched successfully",
    data: {
      court: normalizeCourtImages(req, { ...courtData, images }),
      owner,
      analytics: { ...analytics, totalUsers: users.size },
      slotOverview,
      ownerCommissionStatus: {
        month: selectedMonth,
        year: selectedYear,
        ownerMonthlyRevenue: ownerSettlement.monthlyRevenue,
        thisCourtRevenue,
        commissionPercent: ownerSettlement.commissionPercent,
        amountDue: ownerSettlement.amountDue,
        status: ownerSettlement.status,
        paymentUtr: ownerSettlement.paymentUtr,
        settlementId: ownerSettlement.id
      },
      bookings: bookings.map((booking) => ({
        id: booking.id,
        user: booking.user,
        slot: booking.slot,
        status: booking.status,
        paymentStatus: booking.payment?.status ?? null,
        finalAmount: booking.payment ? Number(booking.payment.finalAmount) : 0,
        checkedIn: booking.checkedIn,
        createdAt: booking.createdAt
      })),
      users: Array.from(users.values())
    }
  });
};

export const pendingCourts = async (_req: any, res: any) => {
  const data = await prisma.court.findMany({
    where: { status: "PENDING_APPROVAL", isApproved: false, deletedAt: null },
    include: { owner: { select: { id: true, name: true, email: true } }, images: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } },
    orderBy: { createdAt: "desc" }
  });
  res.json({ success: true, message: "Pending courts fetched successfully", data: data.map((court) => normalizeCourtImages(_req, court)) });
};

export const adminBookings = async (_req: any, res: any) => {
  const data = await prisma.booking.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      court: { include: { owner: { select: { id: true, name: true, email: true } } } },
      slot: true,
      payment: { include: { refund: true } },
      refund: true
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({ success: true, message: "Bookings fetched successfully", data });
};

export const adminOwners = async (_req: any, res: any) => {
  const data = await prisma.user.findMany({
    where: { role: "OWNER" },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      isSuspended: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { ownedCourts: { where: { deletedAt: null } } } }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({ success: true, message: "Owners fetched successfully", data: data.map((owner) => ({ ...owner, courtsCount: owner._count.ownedCourts })) });
};

export const adminPayments = async (_req: any, res: any) => {
  const data = await prisma.payment.findMany({
    include: { user: { select: { id: true, name: true, email: true } }, booking: { include: { court: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json({ success: true, message: "Payments fetched successfully", data });
};

export const adminRefunds = async (_req: any, res: any) => {
  const data = await prisma.refund.findMany({
    include: { user: { select: { id: true, name: true, email: true } }, booking: { include: { court: { include: { owner: { select: { id: true, name: true, email: true } } } }, slot: true } }, payment: true },
    orderBy: { createdAt: "desc" }
  });
  res.json({ success: true, message: "Refunds fetched successfully", data });
};

export const adminAuditLogs = async (_req: any, res: any) => {
  const data = await prisma.auditLog.findMany({
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  res.json({ success: true, message: "Audit logs fetched successfully", data });
};

export const approveCourt = async (req: any, res: any) => {
  const existing = await prisma.court.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError("Court not found", 404);
  if (existing.deletedAt) throw new AppError("Deleted courts cannot be approved", 400);
  if (!existing.upiId || !existing.upiQrImageUrl) {
    await createAuditLog({
      userId: req.user.id,
      action: AUDIT_ACTIONS.ADMIN_BLOCKED_COURT_APPROVAL_MISSING_UPI,
      entity: "court",
      entityId: existing.id,
      metadata: { courtName: existing.name, hasUpiId: Boolean(existing.upiId), hasUpiQrImage: Boolean(existing.upiQrImageUrl) },
      req
    });
    throw new AppError("Cannot approve court without owner UPI ID and QR code", 400);
  }
  const approvedCourt = await prisma.court.update({
    where: { id: existing.id },
    data: {
      isApproved: true,
      status: CourtStatus.ACTIVE,
      approvedAt: new Date(),
      approvedBy: req.user.id,
      rejectionReason: null
    }
  });

  let generatedSlotCount = 0;
  let skippedSlotCount = 0;
  let slotGenerationWarning: string | null = null;

  if (approvedCourt.defaultScheduleEnabled) {
    try {
      const slotResult = await generateSlotsForCourtSchedule(prisma, approvedCourt);
      generatedSlotCount = slotResult.createdCount ?? 0;
      skippedSlotCount = slotResult.skippedCount ?? 0;
    } catch (error) {
      console.error("[admin approve court] slot generation failed", { courtId: approvedCourt.id, adminId: req.user?.id, error });
      slotGenerationWarning = "Court approved, but slot generation failed. Generate slots manually or retry.";
    }
  }

  await createAuditLog({
    userId: req.user.id,
    action: AUDIT_ACTIONS.ADMIN_APPROVED_COURT,
    entity: "court",
    entityId: approvedCourt.id,
    metadata: { courtName: approvedCourt.name, generatedSlotCount },
    req
  });
  if (approvedCourt.defaultScheduleEnabled && !slotGenerationWarning) {
    await createAuditLog({
      userId: req.user.id,
      action: AUDIT_ACTIONS.ADMIN_APPROVED_COURT_AND_GENERATED_SLOTS,
      entity: "court",
      entityId: approvedCourt.id,
      metadata: { courtName: approvedCourt.name, generatedSlotCount, skippedSlotCount },
      req
    });
  }
  res.json({
    success: true,
    message: slotGenerationWarning ? "Court approved, but slot generation failed" : "Court approved successfully",
    data: { ...approvedCourt, generatedSlotCount, slotGenerationWarning }
  });
};

export const updateCourtUpiDetails = async (req: any, res: any) => {
  const court = await prisma.court.findUnique({ where: { id: String(req.params.id) } });
  if (!court) throw new AppError("Court not found", 404);
  if (court.deletedAt) throw new AppError("Deleted courts cannot be updated", 400);

  const upiId = normalizeUpiId(req.body.upiId);
  const file = req.file as Express.Multer.File | undefined;
  const qrUpdate = file
    ? (() => {
        const qrUrl = uploadedUpiQrUrl(req, file);
        if (!qrUrl) throw new AppError("QR image upload failed. Please upload JPG, PNG, or WEBP.", 400);
        return { upiQrImageUrl: qrUrl };
      })()
    : {};
  const data = await prisma.court.update({
    where: { id: court.id },
    data: {
      upiId,
      ...qrUpdate,
      upiUpdatedAt: new Date(),
      upiUpdatedBy: req.user.id
    }
  });

  await createAuditLog({
    userId: req.user.id,
    action: AUDIT_ACTIONS.ADMIN_UPDATED_COURT_UPI_DETAILS,
    entity: "court",
    entityId: data.id,
    metadata: { courtId: data.id, courtName: data.name, oldUpiId: maskUpi(court.upiId), newUpiId: maskUpi(data.upiId), updatedBy: req.user.id },
    req
  });
  if (file) {
    await createAuditLog({
      userId: req.user.id,
      action: AUDIT_ACTIONS.ADMIN_UPDATED_COURT_UPI_QR,
      entity: "court",
      entityId: data.id,
      metadata: { courtId: data.id, courtName: data.name, updatedBy: req.user.id },
      req
    });
  }

  res.json({ success: true, message: "Court UPI details updated successfully", data: normalizeCourtImages(req, data) });
};

export const rejectCourt = async (req: any, res: any) => {
  const reason = String(req.body.reason || "").trim();
  if (!reason) throw new AppError("Rejection reason is required", 400);
  const existing = await prisma.court.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError("Court not found", 404);
  if (existing.deletedAt) throw new AppError("Deleted courts cannot be rejected", 400);

  const data = await prisma.court.update({
    where: { id: req.params.id },
    data: {
      isApproved: false,
      status: CourtStatus.REJECTED,
      rejectionReason: reason,
      approvedAt: null,
      approvedBy: null
    }
  });
  await createAuditLog({
    userId: req.user.id,
    action: AUDIT_ACTIONS.ADMIN_REJECTED_COURT,
    entity: "court",
    entityId: data.id,
    metadata: { reason, courtName: data.name },
    req
  });
  res.json({ success: true, message: "Court rejected successfully", data });
};

export const updateUserStatus = async (req: any, res: any) => {
  const { status } = req.body;
  if (!["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"].includes(status)) {
    throw new AppError("Valid status is required", 400);
  }

  const target = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
  if (!target) throw new AppError("User not found", 404);

  const activeAdminCount = await prisma.user.count({ where: activeAdminWhere() });
  if (target.role === Role.ADMIN && status !== UserStatus.ACTIVE && target.status === UserStatus.ACTIVE && !target.deletedAt && activeAdminCount <= 1) {
    throw new AppError("At least one admin account must remain active.", 400);
  }
  if (target.role === Role.ADMIN && status === UserStatus.ACTIVE && (target.status !== UserStatus.ACTIVE || target.deletedAt) && activeAdminCount >= ADMIN_ACCOUNT_LIMIT) {
    await createAuditLog({
      userId: req.user.id,
      action: AUDIT_ACTIONS.ADMIN_LIMIT_BLOCKED,
      entity: "USER",
      entityId: target.id,
      metadata: { targetUserId: target.id, targetEmail: target.email, targetRole: target.role, activeAdminCount },
      req
    });
    throw new AppError("Admin account limit reached. Only 2 admin accounts are allowed.", 400);
  }

  const data = await prisma.user.update({
    where: { id: target.id },
    data: {
      status,
      isSuspended: status === "SUSPENDED" || status === "DELETED",
      deletedAt: status === "DELETED" ? new Date() : null
    },
    select: adminSafeUserSelect
  });
  const isDeleteOrDeactivate = status !== UserStatus.ACTIVE;
  await createAuditLog({
    userId: req.user.id,
    action: isDeleteOrDeactivate ? adminDeleteAction(data.role) : AUDIT_ACTIONS.ADMIN_CHANGED_USER_STATUS,
    entity: "USER",
    entityId: data.id,
    metadata: {
      targetUserId: data.id,
      targetEmail: data.email,
      targetRole: data.role,
      status,
      activeAdminCount: data.role === Role.ADMIN && isDeleteOrDeactivate ? Math.max(activeAdminCount - 1, 0) : activeAdminCount
    },
    req
  });
  res.json({ success: true, message: "User status updated successfully", data });
};

export const deleteUser = async (req: any, res: any) => {
  const userId = String(req.params.id);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found", 404);
  if (user.status === UserStatus.DELETED || user.deletedAt) throw new AppError("User is already deleted", 400);

  const activeAdminCount = await prisma.user.count({ where: activeAdminWhere() });
  if (user.role === Role.ADMIN && user.status === UserStatus.ACTIVE && !user.deletedAt && activeAdminCount <= 1) {
    throw new AppError("At least one admin account must remain active.", 400);
  }

  const data = await prisma.user.update({
    where: { id: user.id },
    data: { status: UserStatus.DELETED, isSuspended: true, deletedAt: new Date() },
    select: adminSafeUserSelect
  });
  await createAuditLog({
    userId: req.user.id,
    action: adminDeleteAction(user.role),
    entity: "USER",
    entityId: user.id,
    metadata: {
      targetUserId: user.id,
      targetEmail: user.email,
      targetRole: user.role,
      activeAdminCount: user.role === Role.ADMIN ? Math.max(activeAdminCount - 1, 0) : activeAdminCount
    },
    req
  });

  res.json({ success: true, message: "User deleted successfully", data });
};

export const resetUserPassword = async (req: any, res: any) => {
  const { newPassword } = resetPasswordSchema.parse(req.body);
  const target = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
  if (!target) throw new AppError("User not found", 404);
  if (target.role === Role.ADMIN) throw new AppError("Admin password reset for another admin is not allowed", 403);
  if (![Role.USER, Role.OWNER].includes(target.role)) throw new AppError("Password reset is allowed only for users and owners", 400);

  await prisma.user.update({
    where: { id: target.id },
    data: { password: await hashPassword(newPassword) }
  });

  await createAuditLog({
    userId: req.user.id,
    action: AUDIT_ACTIONS.ADMIN_RESET_USER_PASSWORD,
    entity: "USER",
    entityId: target.id,
    metadata: { targetEmail: target.email, targetRole: target.role },
    req
  });

  res.json({ success: true, message: "Password reset successfully" });
};

export const deleteOwner = async (req: any, res: any) => {
  const ownerId = String(req.params.id);
  if (ownerId === req.user.id) throw new AppError("Admin cannot delete self", 400);

  const owner = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!owner) throw new AppError("Owner not found", 404);
  if (owner.role !== Role.OWNER) throw new AppError("User is not a court owner", 400);

  const deletedAt = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: owner.id }, data: { status: UserStatus.DELETED, isSuspended: true, deletedAt } }),
    prisma.court.updateMany({ where: { ownerId: owner.id }, data: { status: CourtStatus.INACTIVE, isApproved: false, deletedAt } })
  ]);
  await createAuditLog({
    userId: req.user.id,
    action: AUDIT_ACTIONS.ADMIN_DELETED_OWNER,
    entity: "OWNER",
    entityId: owner.id,
    metadata: {
      targetUserId: owner.id,
      targetEmail: owner.email,
      targetRole: owner.role,
      activeAdminCount: await prisma.user.count({ where: activeAdminWhere() })
    },
    req
  });

  res.json({ success: true, message: "Owner deleted successfully" });
};

export const deleteCourt = async (req: any, res: any) => {
  const courtId = String(req.params.id);
  const court = await prisma.court.findUnique({ where: { id: courtId }, include: { owner: { select: { id: true, email: true } } } });
  if (!court) throw new AppError("Court not found", 404);

  await prisma.court.update({
    where: { id: court.id },
    data: { deletedAt: new Date(), status: CourtStatus.INACTIVE, isApproved: false }
  });
  await createAuditLog({
    userId: req.user.id,
    action: AUDIT_ACTIONS.ADMIN_DELETED_COURT,
    entity: "COURT",
    entityId: court.id,
    metadata: { courtName: court.name, ownerId: court.ownerId, ownerEmail: court.owner.email },
    req
  });

  res.json({ success: true, message: "Court deleted successfully" });
};

export const updateCourtApproval = async (req: any, res: any) => {
  const { isApproved } = req.body;
  const data = await prisma.court.update({
    where: { id: req.params.id },
    data: { isApproved: Boolean(isApproved) }
  });
  res.json({ success: true, message: "Court approval updated successfully", data });
};

export const updateCourtStatus = async (req: any, res: any) => {
  const { status } = req.body;
  if (!["ACTIVE", "INACTIVE", "MAINTENANCE"].includes(status)) throw new AppError("Valid court status is required", 400);
  const existing = await prisma.court.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError("Court not found", 404);
  if (existing.deletedAt) throw new AppError("Deleted courts cannot be updated", 400);
  const data = await prisma.court.update({
    where: { id: req.params.id },
    data: {
      status,
      isApproved: status === "ACTIVE" ? true : undefined
    }
  });
  res.json({ success: true, message: "Court status updated successfully", data });
};

export const debugCourtImages = async (req: any, res: any) => {
  const court = await prisma.court.findUnique({
    where: { id: String(req.params.courtId) },
    include: { images: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } }
  });
  if (!court) throw new AppError("Court not found", 404);

  res.json({
    success: true,
    message: "Court image debug fetched successfully",
    data: {
      id: court.id,
      name: court.name,
      imageUrl: court.imageUrl,
      normalizedImageUrl: toPublicImageUrl(req, court.imageUrl),
      imageExistsOnDisk: localUploadExists(court.imageUrl),
      upiQrImageUrl: court.upiQrImageUrl,
      normalizedUpiQrImageUrl: toPublicQrImageUrl(req, court.upiQrImageUrl),
      upiQrExistsOnDisk: localUploadExists(court.upiQrImageUrl),
      images: court.images.map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
        normalizedImageUrl: toPublicImageUrl(req, image.imageUrl),
        isPrimary: image.isPrimary,
        existsOnDisk: localUploadExists(image.imageUrl)
      }))
    }
  });
};
