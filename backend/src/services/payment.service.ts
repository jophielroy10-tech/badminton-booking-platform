import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.middleware.js";

export const createMockPayment = async (userId: string, bookingId: string) => {
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, userId }, include: { slot: true } });
  if (!booking) throw new AppError("Booking hold not found", 404);
  if (booking.expiresAt && booking.expiresAt <= new Date()) throw new AppError("Booking hold has expired", 400);

  const amount = booking.slot.price;

  return prisma.payment.create({
    data: {
      userId,
      bookingId: booking.id,
      amount,
      platformFee: 0,
      gst: 0,
      finalAmount: amount,
      status: "PENDING",
      provider: "MOCK",
      razorpayPaymentId: `mock_${crypto.randomUUID()}`
    }
  });
};

export const verifyMockPayment = async (userId: string, paymentId: string, success: boolean) => {
  const payment = await prisma.payment.findFirst({ where: { id: paymentId, userId } });
  if (!payment) throw new AppError("Payment not found", 404);

  return prisma.payment.update({
    where: { id: payment.id },
    data: { status: success ? "SUCCESS" : "FAILED" }
  });
};
