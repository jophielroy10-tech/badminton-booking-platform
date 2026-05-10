import { Router } from "express";
import { Role } from "@prisma/client";
import { createCourt, deleteCourt, getCourtById, getCourts, updateCourt, updateCourtStatus } from "../controllers/court.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const courtRoutes = Router();

courtRoutes.get("/", asyncHandler(getCourts));
courtRoutes.get("/:id", asyncHandler(getCourtById));
courtRoutes.post("/", requireAuth, allowRoles(Role.OWNER, Role.ADMIN), asyncHandler(createCourt));
courtRoutes.patch("/:id", requireAuth, allowRoles(Role.OWNER, Role.ADMIN), asyncHandler(updateCourt));
courtRoutes.delete("/:id", requireAuth, allowRoles(Role.OWNER, Role.ADMIN), asyncHandler(deleteCourt));
courtRoutes.patch("/:id/status", requireAuth, allowRoles(Role.OWNER, Role.ADMIN), asyncHandler(updateCourtStatus));
