import { Router } from "express";
import { Role } from "@prisma/client";
import { walletBalance, walletTransactions } from "../controllers/wallet.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const walletRoutes = Router();

walletRoutes.use(requireAuth, allowRoles(Role.USER));
walletRoutes.get("/", asyncHandler(walletBalance));
walletRoutes.get("/transactions", asyncHandler(walletTransactions));
