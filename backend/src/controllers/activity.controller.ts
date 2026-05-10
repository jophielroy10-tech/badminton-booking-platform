import { Prisma, Role } from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.middleware.js";
import { AUDIT_ACTIONS, createAuditLog } from "../utils/audit.js";

const frontendTrackableActions = new Set([
  AUDIT_ACTIONS.USER_VIEWED_COURTS,
  AUDIT_ACTIONS.USER_VIEWED_COURT_DETAILS,
  AUDIT_ACTIONS.USER_STARTED_BOOKING,
  AUDIT_ACTIONS.OWNER_VIEWED_BOOKINGS
]);

const loginActions = [AUDIT_ACTIONS.USER_LOGIN, AUDIT_ACTIONS.OWNER_LOGIN, AUDIT_ACTIONS.ADMIN_LOGIN];
const ownerActionPrefix = "OWNER_";
const adminActionPrefix = "ADMIN_";

export const enterWebsite = async (req: Request, res: Response) => {
  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.WEBSITE_ENTERED,
    entity: "session",
    metadata: { path: req.body?.path || "/", role: req.user!.role },
    req
  });
  res.json({ success: true, message: "Activity recorded" });
};

export const trackActivity = async (req: Request, res: Response) => {
  const action = String(req.body?.action || "");
  if (!frontendTrackableActions.has(action as any)) throw new AppError("Activity action is not allowed", 400);

  await createAuditLog({
    userId: req.user!.id,
    action,
    entity: String(req.body?.entity || "activity"),
    entityId: req.body?.entityId ? String(req.body.entityId) : undefined,
    metadata: typeof req.body?.metadata === "object" && req.body.metadata ? req.body.metadata : {},
    req
  });

  res.json({ success: true, message: "Activity recorded" });
};

export const adminActivitySummary = async (_req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayWhere = { createdAt: { gte: today } };
  const [todayLogins, todayUserLogins, todayOwnerLogins, todayAdminLogins, todayBookings, todayPayments, todayOwnerActions, todayAdminActions, recentActivities] =
    await Promise.all([
      prisma.auditLog.count({ where: { ...todayWhere, action: { in: loginActions } } }),
      prisma.auditLog.count({ where: { ...todayWhere, action: AUDIT_ACTIONS.USER_LOGIN } }),
      prisma.auditLog.count({ where: { ...todayWhere, action: AUDIT_ACTIONS.OWNER_LOGIN } }),
      prisma.auditLog.count({ where: { ...todayWhere, action: AUDIT_ACTIONS.ADMIN_LOGIN } }),
      prisma.auditLog.count({ where: { ...todayWhere, action: { in: [AUDIT_ACTIONS.BOOKING_HOLD_CREATED, AUDIT_ACTIONS.BOOKING_CONFIRMED] } } }),
      prisma.auditLog.count({ where: { ...todayWhere, action: { in: [AUDIT_ACTIONS.PAYMENT_ORDER_CREATED, AUDIT_ACTIONS.PAYMENT_VERIFIED] } } }),
      prisma.auditLog.count({ where: { ...todayWhere, action: { startsWith: ownerActionPrefix } } }),
      prisma.auditLog.count({ where: { ...todayWhere, action: { startsWith: adminActionPrefix } } }),
      prisma.auditLog.findMany({
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: "desc" },
        take: 5
      })
    ]);

  res.json({
    success: true,
    data: {
      todayLogins,
      todayUserLogins,
      todayOwnerLogins,
      todayAdminLogins,
      todayBookings,
      todayPayments,
      todayOwnerActions,
      todayAdminActions,
      recentActivities
    }
  });
};

export const adminActivityList = async (req: Request, res: Response) => {
  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.ADMIN_VIEWED_ACTIVITY_LOGS,
    entity: "auditLog",
    metadata: { query: req.query },
    req
  });

  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
  const skip = (page - 1) * limit;
  const where: Prisma.AuditLogWhereInput = {};

  if (typeof req.query.action === "string" && req.query.action) where.action = req.query.action;
  if (typeof req.query.entity === "string" && req.query.entity) where.entity = req.query.entity;
  if (typeof req.query.userId === "string" && req.query.userId) where.userId = req.query.userId;
  if (typeof req.query.role === "string" && Object.values(Role).includes(req.query.role as Role)) {
    where.user = { role: req.query.role as Role };
  }

  const createdAt: Prisma.DateTimeFilter = {};
  if (typeof req.query.from === "string" && req.query.from) createdAt.gte = new Date(req.query.from);
  if (typeof req.query.to === "string" && req.query.to) createdAt.lte = new Date(req.query.to);
  if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;

  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const search = req.query.search.trim();
    where.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { entity: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } }
    ];
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    }),
    prisma.auditLog.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) }
    }
  });
};
