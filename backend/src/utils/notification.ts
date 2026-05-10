import { prisma } from "../lib/prisma.js";

export interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: string;
}

export async function createNotification(data: NotificationData) {
  try {
    await prisma.notification.create({
      data,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    // Don't throw error to avoid breaking main flow
  }
}

export const NOTIFICATION_TYPES = {
  BOOKING_PENDING: "BOOKING_PENDING",
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  PAYMENT_SUCCESS: "PAYMENT_SUCCESS",
  BOOKING_CANCELLED: "BOOKING_CANCELLED",
  REFUND_INITIATED: "REFUND_INITIATED",
} as const;