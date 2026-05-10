import { Router } from "express";
import { sendOtp, verifyOtp } from "../controllers/otp.controller.js";
import { authLimiter } from "../middleware/rateLimit.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const otpRoutes = Router();

otpRoutes.post("/send", authLimiter, asyncHandler(sendOtp));
otpRoutes.post("/verify", authLimiter, asyncHandler(verifyOtp));
