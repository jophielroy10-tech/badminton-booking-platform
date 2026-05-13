import { Router } from "express";
import { Role } from "@prisma/client";
import {
  adminActivityList,
  adminActivitySummary,
} from "../controllers/activity.controller.js";
import {
  adminAuditLogs,
  adminBookings,
  adminCourts,
  adminCourtDetails,
  adminDashboard,
  debugCourtImages,
  downloadBackup,
  getAdminSettings,
  getAdminPaymentSettings,
  adminOwners,
  adminPayments,
  pendingCourts,
  adminRefunds,
  adminUsers,
  adminUserStats,
  approveCourt,
  createAdminUser,
  deleteCourt,
  deleteOwner,
  deleteUser,
  rejectCourt,
  resetUserPassword,
  updateCourtApproval,
  updateCourtStatus,
  updateCourtUpiDetails,
  updateAdminSettings,
  updateAdminPaymentSettings,
  uploadAdminPaymentQr,
  updateUserStatus
} from "../controllers/admin.controller.js";
import {
  adminRecalculateSettlements,
  adminRejectSettlement,
  adminRejectOwnerSettlementPayment,
  adminEarnings,
  adminGenerateDailySettlements,
  adminGenerateMonthlySettlements,
  adminMarkSettlementPaid,
  adminOwnerSettlementPayments,
  adminSettlementDetails,
  adminSettlements,
  adminSettlementSummary,
  adminVerifyOwnerSettlementPayment,
  adminVerifySettlement
} from "../controllers/settlement.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { courtImageUpload, processUploadedImages } from "../middleware/upload.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const adminRoutes = Router();

adminRoutes.use(requireAuth, allowRoles(Role.ADMIN));
adminRoutes.get("/backup", asyncHandler(downloadBackup));
adminRoutes.get("/dashboard", asyncHandler(adminDashboard));
adminRoutes.get("/settings", asyncHandler(getAdminSettings));
adminRoutes.patch("/settings", asyncHandler(updateAdminSettings));
adminRoutes.get("/payment-settings", asyncHandler(getAdminPaymentSettings));
adminRoutes.patch("/payment-settings", asyncHandler(updateAdminPaymentSettings));
adminRoutes.post("/payment-settings/qr-upload", courtImageUpload.single("upiQrImage"), processUploadedImages, asyncHandler(uploadAdminPaymentQr));
adminRoutes.get("/activity/summary", asyncHandler(adminActivitySummary));
adminRoutes.get("/activity", asyncHandler(adminActivityList));
adminRoutes.get("/settlements/summary", asyncHandler(adminSettlementSummary));
adminRoutes.get("/settlements/owner-payments", asyncHandler(adminOwnerSettlementPayments));
adminRoutes.get("/settlements", asyncHandler(adminSettlements));
adminRoutes.post("/settlements/generate-daily", asyncHandler(adminGenerateDailySettlements));
adminRoutes.post("/settlements/generate-monthly", asyncHandler(adminGenerateMonthlySettlements));
adminRoutes.post("/settlements/recalculate", asyncHandler(adminRecalculateSettlements));
adminRoutes.get("/settlements/:id", asyncHandler(adminSettlementDetails));
adminRoutes.patch("/settlements/:id/mark-paid", asyncHandler(adminMarkSettlementPaid));
adminRoutes.patch("/settlements/:id/verify-owner-payment", asyncHandler(adminVerifyOwnerSettlementPayment));
adminRoutes.patch("/settlements/:id/reject-owner-payment", asyncHandler(adminRejectOwnerSettlementPayment));
adminRoutes.patch("/settlements/:id/verify", asyncHandler(adminVerifySettlement));
adminRoutes.patch("/settlements/:id/reject", asyncHandler(adminRejectSettlement));
adminRoutes.get("/earnings", asyncHandler(adminEarnings));
adminRoutes.get("/users/stats", asyncHandler(adminUserStats));
adminRoutes.get("/users", asyncHandler(adminUsers));
adminRoutes.post("/users", asyncHandler(createAdminUser));
adminRoutes.get("/owners", asyncHandler(adminOwners));
adminRoutes.get("/courts/pending", asyncHandler(pendingCourts));
adminRoutes.get("/debug/court-images/:courtId", asyncHandler(debugCourtImages));
adminRoutes.get("/courts", asyncHandler(adminCourts));
adminRoutes.get("/courts/:id/details", asyncHandler(adminCourtDetails));
adminRoutes.get("/bookings", asyncHandler(adminBookings));
adminRoutes.get("/payments", asyncHandler(adminPayments));
adminRoutes.get("/refunds", asyncHandler(adminRefunds));
adminRoutes.get("/audit-logs", asyncHandler(adminAuditLogs));
adminRoutes.patch("/users/:id/status", asyncHandler(updateUserStatus));
adminRoutes.patch("/users/:id/password", asyncHandler(resetUserPassword));
adminRoutes.delete("/users/:id", asyncHandler(deleteUser));
adminRoutes.delete("/owners/:id", asyncHandler(deleteOwner));
adminRoutes.patch("/courts/:id/approve", asyncHandler(approveCourt));
adminRoutes.patch("/courts/:id/reject", asyncHandler(rejectCourt));
adminRoutes.patch("/courts/:id/approval", asyncHandler(updateCourtApproval));
adminRoutes.patch("/courts/:id/upi", courtImageUpload.single("upiQrImage"), processUploadedImages, asyncHandler(updateCourtUpiDetails));
adminRoutes.patch("/courts/:id/status", asyncHandler(updateCourtStatus));
adminRoutes.delete("/courts/:id", asyncHandler(deleteCourt));
