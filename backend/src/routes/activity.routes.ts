import { Router } from "express";
import { enterWebsite, trackActivity } from "../controllers/activity.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const activityRoutes = Router();

activityRoutes.use(requireAuth);
activityRoutes.post("/enter", asyncHandler(enterWebsite));
activityRoutes.post("/track", asyncHandler(trackActivity));
