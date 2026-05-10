import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.middleware.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { signJwt } from "../utils/jwt.js";

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  walletBalance: true,
  isSuspended: true,
  createdAt: true,
  updatedAt: true
};

export const signup = async (input: { name: string; email: string; password: string; role?: "USER" | "OWNER" | "ADMIN" }) => {
  const role = input.role ?? "USER";
  if (role === "ADMIN") throw new AppError("Admin signup is not allowed", 403);

  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) throw new AppError("Email is already registered", 409);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password: await hashPassword(input.password),
      role,
      status: "ACTIVE"
    },
    select: safeUserSelect
  });

  const token = signJwt({ userId: user.id, role: user.role });
  return { user, token };
};

export const login = async (input: { email: string; password: string; expectedRole: "USER" | "OWNER" | "ADMIN" }) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new AppError("Invalid email or password", 401);
  if (user.isSuspended || user.status === "SUSPENDED" || user.status === "DELETED") {
    throw new AppError("Account is disabled. Please contact admin.", 403);
  }
  if (user.status !== "ACTIVE") throw new AppError("Your account is not active", 403);

  const isPasswordValid = await comparePassword(input.password, user.password);
  if (!isPasswordValid) throw new AppError("Invalid email or password", 401);

  if (user.role !== input.expectedRole) {
    throw new AppError("Wrong login type selected", 403);
  }

  const safeUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: safeUserSelect });
  const token = signJwt({ userId: user.id, role: user.role });
  return { user: safeUser, token };
};
