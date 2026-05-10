import type { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "./error.middleware.js";

export const allowRoles =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError("Authentication token missing", 401));
    if (!roles.includes(req.user.role)) return next(new AppError("Access denied", 403));
    next();
  };
