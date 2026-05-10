import { z } from "zod";

export const slotHoldSchema = z.object({
  slotId: z.string().uuid("Valid slotId is required"),
  couponCode: z.string().optional()
});

export const confirmBookingSchema = z.object({
  bookingId: z.string().uuid("Valid bookingId is required"),
  razorpay_order_id: z.string().min(1, "Razorpay order ID is required"),
  razorpay_payment_id: z.string().min(1, "Razorpay payment ID is required"),
  razorpay_signature: z.string().min(1, "Razorpay signature is required")
});

export const otpSendSchema = z.object({
  email: z.string().email().toLowerCase(),
  purpose: z.string().min(2).default("BOOKING")
});

export const otpVerifySchema = otpSendSchema.extend({
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits")
});

export const paymentVerifySchema = z.object({
  paymentId: z.string().uuid("Valid paymentId is required"),
  success: z.boolean()
});
