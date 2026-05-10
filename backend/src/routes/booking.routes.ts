import { Router } from "express";
import { Role } from "@prisma/client";
import { createHold, createUpiHold, confirmBooking, myBookings, cancelBooking, cancelBookingPreview, expireHolds } from "../controllers/booking.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const bookingRoutes = Router();

bookingRoutes.post("/hold", requireAuth, allowRoles(Role.USER), asyncHandler(createHold));
bookingRoutes.post("/hold-upi", requireAuth, allowRoles(Role.USER), asyncHandler(createUpiHold));
bookingRoutes.post("/confirm", requireAuth, allowRoles(Role.USER), asyncHandler(confirmBooking));
bookingRoutes.get("/my", requireAuth, allowRoles(Role.USER), asyncHandler(myBookings));
bookingRoutes.get("/:id/cancel-preview", requireAuth, allowRoles(Role.USER), asyncHandler(cancelBookingPreview));
bookingRoutes.patch("/:id/cancel", requireAuth, allowRoles(Role.USER), asyncHandler(cancelBooking));
bookingRoutes.post("/expire-holds", asyncHandler(expireHolds)); // Can be called manually or by cron
