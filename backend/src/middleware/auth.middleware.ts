import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyJwt } from "../utils/jwt.js";
import { AppError } from "./error.middleware.js";

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) throw new AppError("Authentication token missing", 401);

  let payload;
  try {
    payload = verifyJwt(token);
  } catch {
    throw new AppError("Invalid or expired token", 401);
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, role: true, status: true, isSuspended: true }
  });

  if (!user) throw new AppError("Invalid or expired token", 401);
  if (user.isSuspended || user.status === "SUSPENDED" || user.status === "DELETED") {
    throw new AppError("Account is disabled. Please contact admin.", 403);
  }

  req.user = { id: user.id, email: user.email, role: user.role };
  next();
});
