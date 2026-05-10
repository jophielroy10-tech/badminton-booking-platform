import crypto from "crypto";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.middleware.js";

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

const hashOtp = (otp: string) => crypto.createHash("sha256").update(otp).digest("hex");

export const sendOtp = async (email: string, purpose: string) => {
  const latestOtp = await prisma.oTPVerification.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: "desc" }
  });

  if (latestOtp && Date.now() - latestOtp.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new AppError("Please wait 30 seconds before requesting another OTP", 429);
  }

  const otp = crypto.randomInt(100000, 999999).toString();

  await prisma.oTPVerification.create({
    data: {
      email,
      purpose,
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS)
    }
  });

  return {
    sent: true,
    ...(env.NODE_ENV === "development" ? { otp } : {})
  };
};

export const verifyOtp = async (email: string, purpose: string, otp: string) => {
  const record = await prisma.oTPVerification.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: "desc" }
  });

  if (!record) throw new AppError("OTP not found. Please request a new OTP", 404);
  if (record.expiresAt < new Date()) {
    await prisma.oTPVerification.delete({ where: { id: record.id } });
    throw new AppError("OTP has expired", 400);
  }
  if (record.attempts >= MAX_ATTEMPTS) throw new AppError("Maximum OTP attempts reached", 429);

  if (record.otpHash !== hashOtp(otp)) {
    await prisma.oTPVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw new AppError("Invalid OTP", 400);
  }

  await prisma.oTPVerification.delete({ where: { id: record.id } });
  return { verified: true };
};
