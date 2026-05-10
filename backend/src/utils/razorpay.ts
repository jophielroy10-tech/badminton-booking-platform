import crypto from "crypto";
import { env } from "../config/env.js";
import { getRazorpayClient, isRazorpayConfigError } from "../lib/razorpay.js";
import { AppError } from "../middleware/error.middleware.js";

export interface RazorpayOrderOptions {
  amount: number; // in paisa
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayWebhookEvent {
  event: string;
  payment?: {
    entity: {
      id: string;
      order_id: string;
      amount: number;
      currency: string;
      status: string;
      captured: boolean;
    };
  };
}

/**
 * Create a Razorpay order
 */
export async function createRazorpayOrder(options: RazorpayOrderOptions) {
  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: options.amount,
      currency: options.currency,
      receipt: options.receipt,
      notes: options.notes,
    });
    return order;
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    if (isRazorpayConfigError(error)) throw new AppError(error.message, 500);
    throw new AppError(error instanceof Error ? error.message : "Failed to create payment order", 500);
  }
}

/**
 * Verify Razorpay payment signature
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  try {
    const sign = orderId + "|" + paymentId;
    const expectedSign = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    const received = Buffer.from(signature, "hex");
    const expected = Buffer.from(expectedSign, "hex");
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
  } catch (error) {
    console.error("Error verifying Razorpay signature:", error);
    return false;
  }
}

/**
 * Fetch payment details from Razorpay API
 */
export async function fetchRazorpayPayment(paymentId: string) {
  try {
    const razorpay = getRazorpayClient();
    const payment = await razorpay.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    console.error("Error fetching Razorpay payment:", error);
    if (isRazorpayConfigError(error)) throw new AppError(error.message, 500);
    throw new AppError("Failed to fetch payment details", 500);
  }
}

export async function createRazorpayRefund(paymentId: string, amount: number, notes: Record<string, string>) {
  try {
    const razorpay = getRazorpayClient();
    return await razorpay.payments.refund(paymentId, {
      amount,
      notes
    });
  } catch (error) {
    console.error("Error creating Razorpay refund:", error);
    if (isRazorpayConfigError(error)) throw new AppError(error.message, 500);
    throw new AppError(error instanceof Error ? error.message : "Failed to create refund", 500);
  }
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    const received = Buffer.from(signature, "hex");
    const expected = Buffer.from(expectedSignature, "hex");
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}
