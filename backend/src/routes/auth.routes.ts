import { Router } from "express";
import { login, logout, signup } from "../controllers/auth.controller.js";
import { authLimiter } from "../middleware/rateLimit.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authRoutes = Router();

authRoutes.post("/signup", authLimiter, asyncHandler(signup));
authRoutes.post("/login", authLimiter, asyncHandler(login));
authRoutes.post("/logout", asyncHandler(logout));
