import { Router } from "express";
import { Role } from "@prisma/client";
import { confirmBooking } from "../controllers/booking.controller.js";
import { paymentDetails, razorpayWebhook, submitUpiPayment } from "../controllers/payment.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const paymentRoutes = Router();

// Webhook route - must use express.raw() middleware in main app
paymentRoutes.post("/razorpay/webhook", asyncHandler(razorpayWebhook));
paymentRoutes.get("/details/:bookingId", requireAuth, allowRoles(Role.USER), asyncHandler(paymentDetails));
paymentRoutes.post("/razorpay/verify", requireAuth, allowRoles(Role.USER), asyncHandler(confirmBooking));
paymentRoutes.post("/upi/submit", requireAuth, allowRoles(Role.USER), asyncHandler(submitUpiPayment));
