import { Router } from "express";
import { Role } from "@prisma/client";
import {
  checkInUser,
  createOwnerCourt,
  deleteOwnerCourt,
  deleteOwnerCourtImage,
  ownerBookings,
  ownerCourtById,
  ownerCourts,
  ownerDashboard,
  ownerPayments,
  ownerPlatformPaymentSettings,
  ownerUserDetails,
  ownerUsers,
  rejectOwnerUpiPayment,
  setPrimaryOwnerCourtImage,
  updateOwnerCourt,
  updateOwnerCourtStatus,
  verifyOwnerUpiPayment,
  uploadOwnerCourtImage
} from "../controllers/owner.controller.js";
import {
  ownerCurrentSettlement,
  ownerEarnings,
  ownerPayToAdminDetails,
  ownerSettlementSummary,
  ownerSettlements,
  ownerSubmitPayToAdminPayment,
  ownerSubmitSettlementPayment
} from "../controllers/settlement.controller.js";
import {
  blockOwnerSlots,
  deleteOwnerSlot,
  generateOwnerSlots,
  generateOwnerSlotsBulk,
  generateOwnerSlotsFromSchedule,
  makeCourtAvailableDay,
  makeCourtUnavailableDay,
  ownerCourtSlots,
  ownerSlotCourts,
  updateOwnerSlot
} from "../controllers/ownerSlot.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { courtImageUpload, processUploadedImages } from "../middleware/upload.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const ownerRoutes = Router();

ownerRoutes.use(requireAuth, allowRoles(Role.OWNER));
ownerRoutes.get("/dashboard", asyncHandler(ownerDashboard));
ownerRoutes.get("/settlements/current", asyncHandler(ownerCurrentSettlement));
ownerRoutes.get("/settlements/summary", asyncHandler(ownerSettlementSummary));
ownerRoutes.get("/settlements/pay-to-admin", asyncHandler(ownerPayToAdminDetails));
ownerRoutes.post("/settlements/pay-to-admin/submit", asyncHandler(ownerSubmitPayToAdminPayment));
ownerRoutes.get("/settlements", asyncHandler(ownerSettlements));
ownerRoutes.post("/settlements/:id/submit-payment", asyncHandler(ownerSubmitSettlementPayment));
ownerRoutes.get("/earnings", asyncHandler(ownerEarnings));
ownerRoutes.get("/users", asyncHandler(ownerUsers));
ownerRoutes.get("/users/:id", asyncHandler(ownerUserDetails));
ownerRoutes.get("/slots", asyncHandler(ownerSlotCourts));
ownerRoutes.patch("/slots/:slotId", asyncHandler(updateOwnerSlot));
ownerRoutes.delete("/slots/:slotId", asyncHandler(deleteOwnerSlot));
ownerRoutes.get("/courts", asyncHandler(ownerCourts));
const ownerCourtUploadFields = [
  { name: "courtImages", maxCount: 10 },
  { name: "qrImage", maxCount: 1 },
  { name: "images", maxCount: 10 },
  { name: "upiQrImage", maxCount: 1 },
];

ownerRoutes.post("/courts", courtImageUpload.fields(ownerCourtUploadFields), processUploadedImages, asyncHandler(createOwnerCourt));
ownerRoutes.get("/courts/:courtId/slots", asyncHandler(ownerCourtSlots));
ownerRoutes.post("/courts/:courtId/slots/generate", asyncHandler(generateOwnerSlots));
ownerRoutes.post("/courts/:courtId/slots/generate-bulk", asyncHandler(generateOwnerSlotsBulk));
ownerRoutes.post("/courts/:courtId/slots/generate-schedule", asyncHandler(generateOwnerSlotsFromSchedule));
ownerRoutes.post("/courts/:courtId/unavailable-day", asyncHandler(makeCourtUnavailableDay));
ownerRoutes.post("/courts/:courtId/available-day", asyncHandler(makeCourtAvailableDay));
ownerRoutes.post("/courts/:courtId/block-slots", asyncHandler(blockOwnerSlots));
ownerRoutes.get("/courts/:id/details", asyncHandler(ownerCourtById));
ownerRoutes.get("/courts/:id", asyncHandler(ownerCourtById));
ownerRoutes.patch("/courts/:id", courtImageUpload.fields(ownerCourtUploadFields), processUploadedImages, asyncHandler(updateOwnerCourt));
ownerRoutes.delete("/courts/:id", asyncHandler(deleteOwnerCourt));
ownerRoutes.patch("/courts/:id/status", asyncHandler(updateOwnerCourtStatus));
ownerRoutes.post("/courts/:courtId/images", courtImageUpload.array("images", 10), processUploadedImages, asyncHandler(uploadOwnerCourtImage));
ownerRoutes.post("/courts/:id/image", courtImageUpload.single("image"), processUploadedImages, asyncHandler(uploadOwnerCourtImage));
ownerRoutes.delete("/courts/images/:imageId", asyncHandler(deleteOwnerCourtImage));
ownerRoutes.patch("/courts/images/:imageId/primary", asyncHandler(setPrimaryOwnerCourtImage));
ownerRoutes.get("/bookings", asyncHandler(ownerBookings));
ownerRoutes.post("/bookings/check-in", asyncHandler(checkInUser));
ownerRoutes.get("/payments", asyncHandler(ownerPayments));
ownerRoutes.get("/platform-payment-settings", asyncHandler(ownerPlatformPaymentSettings));
ownerRoutes.patch("/payments/:id/verify", asyncHandler(verifyOwnerUpiPayment));
ownerRoutes.patch("/payments/:id/reject", asyncHandler(rejectOwnerUpiPayment));
