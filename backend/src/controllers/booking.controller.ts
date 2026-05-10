import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.middleware.js";
import { AUDIT_ACTIONS, createAuditLog } from "../utils/audit.js";
import { NOTIFICATION_TYPES, createNotification } from "../utils/notification.js";
import { createRazorpayOrder, fetchRazorpayPayment, verifyRazorpaySignature } from "../utils/razorpay.js";
import { sendBookingConfirmationEmail } from "../utils/email.js";
import { getRazorpayKeyId } from "../lib/razorpay.js";
import { releaseExpiredPendingBookings } from "../jobs/releaseExpiredHolds.job.js";
import { calculateFinalAmount, calculateOwnerEarning } from "../utils/platformSettings.js";
import { toPublicQrImageUrl } from "../utils/imageUrl.js";

const HOLD_TTL_MS = 5 * 60 * 1000;
const BLOCKING_CONFIRMED_BOOKING_STATUSES = ["CONFIRMED", "COMPLETED"] as const;
const BLOCKING_PENDING_BOOKING_STATUSES = ["PENDING", "PENDING_PAYMENT"] as const;

async function findActiveBookingForSlot(tx: any, slotId: string, now = new Date()) {
  return tx.booking.findFirst({
    where: {
      slotId,
      OR: [
        { status: { in: BLOCKING_CONFIRMED_BOOKING_STATUSES } },
        {
          status: { in: BLOCKING_PENDING_BOOKING_STATUSES },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
        }
      ]
    },
    select: { id: true, status: true }
  });
}

async function releaseExpiredBookingsForSlot(tx: any, slotId: string, now = new Date()) {
  const expiredBookings = await tx.booking.findMany({
    where: {
      slotId,
      status: { in: BLOCKING_PENDING_BOOKING_STATUSES },
      expiresAt: { lte: now }
    },
    include: { payment: true }
  });

  for (const booking of expiredBookings) {
    await tx.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED" } });
    if (booking.payment?.status === "PENDING") {
      await tx.payment.update({ where: { id: booking.payment.id }, data: { status: "EXPIRED" } });
    }
  }
}

function createUpiLink(params: { upiId: string; courtName: string; amount: number; bookingId: string }) {
  const search = new URLSearchParams({
    pa: params.upiId,
    pn: params.courtName,
    am: params.amount.toFixed(2),
    cu: "INR",
    tn: `Booking-${params.bookingId}`
  });
  return `upi://pay?${search.toString()}`;
}

export const createHold = async (req: Request, res: Response) => {
  const { slotId, couponCode } = req.body;
  const userId = req.user!.id;

  if (process.env.NODE_ENV === "development") {
    console.log("[booking:hold] request", { body: req.body, userId, slotId });
  }

  if (!slotId) throw new AppError("Slot ID is required", 400);

  const slot = await prisma.slot.findUnique({
    where: { id: String(slotId) },
    include: { court: true }
  });
  if (!slot) throw new AppError("Slot not found", 404);
  if (slot.court.deletedAt || slot.court.status !== "ACTIVE" || !slot.court.isApproved) {
    throw new AppError("Court is not available for booking", 400);
  }

  if (slot.status === "HOLD" && slot.lockedUntil && slot.lockedUntil <= new Date()) {
    await releaseExpiredPendingBookings();
    await prisma.slot.update({
      where: { id: slot.id },
      data: { status: "AVAILABLE", lockedBy: null, lockedUntil: null }
    });
    slot.status = "AVAILABLE";
    slot.lockedBy = null;
    slot.lockedUntil = null;
  }

  const existing = await prisma.booking.findFirst({
    where: { userId, slotId: slot.id, status: "PENDING", expiresAt: { gt: new Date() } },
    include: { payment: true }
  });

  if (existing?.payment?.razorpayOrderId) {
    return res.json({
      success: true,
      message: "Existing pending booking found",
      bookingId: existing.id,
      paymentId: existing.payment.id,
      razorpayOrderId: existing.payment.razorpayOrderId,
      amount: Number(existing.payment.finalAmount) * 100,
      currency: "INR",
      key: getRazorpayKeyId(),
      data: {
        bookingId: existing.id,
        paymentId: existing.payment.id,
        razorpayOrderId: existing.payment.razorpayOrderId,
        amount: Number(existing.payment.finalAmount) * 100,
        currency: "INR",
        key: getRazorpayKeyId()
      }
    });
  }

  if (slot.status !== "AVAILABLE") throw new AppError("Slot is not available.", 400);

  const discount = couponCode ? 0 : 0;
  const amountDetails = await calculateFinalAmount(Number(slot.price), discount);
  if (process.env.NODE_ENV === "development") {
    console.log("[booking:hold] amount", { slotId: slot.id, amountDetails });
  }
  const expiresAt = new Date(Date.now() + HOLD_TTL_MS);

  const result = await prisma.$transaction(async (tx) => {
    const currentSlot = await tx.slot.findUnique({
      where: { id: slot.id },
      include: { court: true }
    });
    if (!currentSlot) throw new AppError("Slot not found", 404);

    const now = new Date();
    if (currentSlot.status === "HOLD" && currentSlot.lockedUntil && currentSlot.lockedUntil <= now) {
      await releaseExpiredBookingsForSlot(tx, currentSlot.id, now);
      await tx.slot.update({
        where: { id: currentSlot.id },
        data: { status: "AVAILABLE", lockedBy: null, lockedUntil: null }
      });
      currentSlot.status = "AVAILABLE";
      currentSlot.lockedBy = null;
      currentSlot.lockedUntil = null;
    } else if (currentSlot.status !== "AVAILABLE") {
      throw new AppError("Slot is not available.", 400);
    }

    const activeBooking = await findActiveBookingForSlot(tx, currentSlot.id, now);
    if (activeBooking) {
      throw new AppError("This slot is already booked or pending payment.", 409);
    }

    await tx.slot.update({
      where: { id: currentSlot.id },
      data: { status: "HOLD", lockedBy: userId, lockedUntil: expiresAt }
    });

    const booking = await tx.booking.create({
      data: {
        userId,
        courtId: currentSlot.courtId,
        slotId: currentSlot.id,
        status: "PENDING",
        expiresAt,
        idempotencyKey: `${userId}_${currentSlot.id}_${Date.now()}_${uuidv4()}`
      }
    });

    const payment = await tx.payment.create({
      data: {
        bookingId: booking.id,
        userId,
        amount: amountDetails.basePrice,
        platformFee: amountDetails.platformFee,
        gst: amountDetails.gst,
        discount: amountDetails.discount,
        finalAmount: amountDetails.finalAmount,
        currency: "INR",
        status: "PENDING",
        provider: "RAZORPAY"
      }
    });

    const order = await createRazorpayOrder({
      amount: amountDetails.finalAmount * 100,
      currency: "INR",
      receipt: `booking_${booking.id}`,
      notes: { bookingId: booking.id, paymentId: payment.id, userId, courtId: slot.courtId }
    });
    if (process.env.NODE_ENV === "development") {
      console.log("[booking:hold] razorpay order created", { orderId: order.id, bookingId: booking.id });
    }

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: { razorpayOrderId: order.id }
    });

    return { booking, payment: updatedPayment };
  });

  await Promise.all([
    createAuditLog({
      userId,
      action: AUDIT_ACTIONS.BOOKING_HOLD_CREATED,
      entity: "booking",
      entityId: result.booking.id,
      metadata: { slotId: slot.id, courtId: slot.courtId, expiresAt },
      req
    }),
    createAuditLog({
      userId,
      action: AUDIT_ACTIONS.PAYMENT_ORDER_CREATED,
      entity: "payment",
      entityId: result.payment.id,
      metadata: { razorpayOrderId: result.payment.razorpayOrderId },
      req
    }),
    createNotification({
      userId,
      title: "Booking pending",
      message: `Your booking for ${slot.court.name} is held for 5 minutes.`,
      type: NOTIFICATION_TYPES.BOOKING_PENDING
    })
  ]);

  res.status(201).json({
    success: true,
    message: "Booking hold created successfully",
    bookingId: result.booking.id,
    paymentId: result.payment.id,
    razorpayOrderId: result.payment.razorpayOrderId,
    amount: Number(result.payment.finalAmount) * 100,
    currency: "INR",
    key: getRazorpayKeyId(),
    data: {
      bookingId: result.booking.id,
      paymentId: result.payment.id,
      razorpayOrderId: result.payment.razorpayOrderId,
      amount: Number(result.payment.finalAmount) * 100,
      currency: "INR",
      key: getRazorpayKeyId()
    }
  });
};

export const createUpiHold = async (req: Request, res: Response) => {
  const { slotId } = req.body;
  const userId = req.user!.id;
  if (!slotId) throw new AppError("Slot ID is required", 400);

  const slot = await prisma.slot.findUnique({
    where: { id: String(slotId) },
    include: { court: { include: { owner: { select: { id: true, name: true } } } } }
  });
  if (!slot) throw new AppError("Slot not found", 404);
  if (slot.court.deletedAt || slot.court.status !== "ACTIVE" || !slot.court.isApproved) throw new AppError("Court is not available for booking", 400);
  if (!slot.court.upiId) throw new AppError("Court owner payment details are missing", 400);

  if (slot.status === "HOLD" && slot.lockedUntil && slot.lockedUntil <= new Date()) {
    await releaseExpiredPendingBookings();
    await prisma.slot.update({ where: { id: slot.id }, data: { status: "AVAILABLE", lockedBy: null, lockedUntil: null } });
    slot.status = "AVAILABLE";
    slot.lockedBy = null;
    slot.lockedUntil = null;
  }
  const existing = await prisma.booking.findFirst({
    where: { userId, slotId: slot.id, status: "PENDING_PAYMENT", expiresAt: { gt: new Date() } },
    include: { payment: true, court: { include: { owner: { select: { id: true, name: true } } } } }
  });
  if (existing?.payment) {
    const amount = Number(existing.payment.finalAmount);
    return res.json({
      success: true,
      message: "Existing pending UPI booking found",
      data: {
        bookingId: existing.id,
        paymentId: existing.payment.id,
        amount,
        upiId: existing.payment.upiId,
        upiQrImageUrl: toPublicQrImageUrl(req, existing.payment.upiQrImageUrl),
        courtName: existing.court.name,
        ownerName: existing.court.owner.name,
        upiLink: createUpiLink({ upiId: existing.payment.upiId || slot.court.upiId, courtName: existing.court.name, amount, bookingId: existing.id }),
        expiresAt: existing.expiresAt
      }
    });
  }

  if (slot.status !== "AVAILABLE") throw new AppError("Slot is not available.", 400);

  const amountDetails = await calculateFinalAmount(Number(slot.price), 0);
  const expiresAt = new Date(Date.now() + HOLD_TTL_MS);

  const result = await prisma.$transaction(async (tx) => {
    const currentSlot = await tx.slot.findUnique({
      where: { id: slot.id },
      include: { court: { include: { owner: { select: { id: true, name: true } } } } }
    });
    if (!currentSlot) throw new AppError("Slot not found", 404);

    const now = new Date();
    if (currentSlot.status === "HOLD" && currentSlot.lockedUntil && currentSlot.lockedUntil <= now) {
      await releaseExpiredBookingsForSlot(tx, currentSlot.id, now);
      await tx.slot.update({ where: { id: currentSlot.id }, data: { status: "AVAILABLE", lockedBy: null, lockedUntil: null } });
      currentSlot.status = "AVAILABLE";
      currentSlot.lockedBy = null;
      currentSlot.lockedUntil = null;
    } else if (currentSlot.status !== "AVAILABLE") {
      throw new AppError("Slot is not available.", 400);
    }

    const activeBooking = await findActiveBookingForSlot(tx, currentSlot.id, now);
    if (activeBooking) {
      throw new AppError("This slot is already booked or pending payment.", 409);
    }

    await tx.slot.update({ where: { id: currentSlot.id }, data: { status: "HOLD", lockedBy: userId, lockedUntil: expiresAt } });
    const booking = await tx.booking.create({
      data: {
        userId,
        courtId: currentSlot.courtId,
        slotId: currentSlot.id,
        status: "PENDING_PAYMENT",
        expiresAt,
        idempotencyKey: `${userId}_${currentSlot.id}_direct_upi_${Date.now()}_${uuidv4()}`
      }
    });
    const payment = await tx.payment.create({
      data: {
        bookingId: booking.id,
        userId,
        amount: amountDetails.basePrice,
        platformFee: amountDetails.platformFee,
        gst: amountDetails.gst,
        discount: amountDetails.discount,
        finalAmount: amountDetails.finalAmount,
        currency: "INR",
        status: "PENDING",
        provider: "DIRECT_UPI",
        upiId: slot.court.upiId,
        upiQrImageUrl: slot.court.upiQrImageUrl,
        ownerId: slot.court.ownerId
      }
    });
    return { booking, payment };
  });

  const amount = Number(result.payment.finalAmount);
  await Promise.all([
    createAuditLog({
      userId,
      action: AUDIT_ACTIONS.BOOKING_HOLD_CREATED,
      entity: "booking",
      entityId: result.booking.id,
      metadata: { slotId: slot.id, courtId: slot.courtId, provider: "DIRECT_UPI", expiresAt },
      req
    }),
    createAuditLog({
      userId,
      action: AUDIT_ACTIONS.USER_VIEWED_COURT_UPI_PAYMENT_DETAILS,
      entity: "payment",
      entityId: result.payment.id,
      metadata: { courtId: slot.courtId, bookingId: result.booking.id },
      req
    })
  ]);

  res.status(201).json({
    success: true,
    message: "Direct UPI booking hold created successfully",
    data: {
      bookingId: result.booking.id,
      paymentId: result.payment.id,
      amount,
      upiId: slot.court.upiId,
      upiQrImageUrl: toPublicQrImageUrl(req, slot.court.upiQrImageUrl),
      courtName: slot.court.name,
      ownerName: slot.court.owner.name,
      upiLink: createUpiLink({ upiId: slot.court.upiId, courtName: slot.court.name, amount, bookingId: result.booking.id }),
      expiresAt
    }
  });
};

export const confirmBooking = async (req: Request, res: Response) => {
  const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const userId = req.user!.id;

  if (!bookingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new AppError("All payment confirmation fields are required", 400);
  }

  const booking = await prisma.booking.findUnique({
    where: { id: String(bookingId) },
    include: { slot: { include: { court: true } }, payment: true, user: true }
  });
  if (!booking) throw new AppError("Booking not found", 404);
  if (booking.userId !== userId) throw new AppError("Unauthorized access to booking", 403);
  if (booking.status !== "PENDING") throw new AppError("Booking is not in pending state", 400);
  if (booking.expiresAt && booking.expiresAt <= new Date()) throw new AppError("Booking has expired", 400);
  if (!booking.payment) throw new AppError("Payment not found", 404);
  if (booking.payment.razorpayOrderId !== razorpay_order_id) throw new AppError("Invalid order ID", 400);

  if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    throw new AppError("Invalid payment signature", 400);
  }

  const razorpayPayment = await fetchRazorpayPayment(razorpay_payment_id);
  if (Number(razorpayPayment.amount) !== Number(booking.payment.finalAmount) * 100) throw new AppError("Payment amount mismatch", 400);
  if (razorpayPayment.currency !== "INR") throw new AppError("Invalid currency", 400);
  if (razorpayPayment.status !== "captured") throw new AppError("Payment not captured", 400);

  const checkInOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const qrToken = uuidv4();
  const ownerEarning = await calculateOwnerEarning(Number(booking.payment.finalAmount), {
    platformFee: Number(booking.payment.platformFee),
    gst: Number(booking.payment.gst),
    paymentId: booking.payment.id,
    courtId: booking.courtId
  });

  const confirmedBooking = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.booking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED", checkInOtp, qrToken },
      include: { court: true, slot: true, payment: true, user: true }
    });

    await tx.payment.update({
      where: { id: booking.payment!.id },
      data: { status: "SUCCESS", razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature }
    });

    await tx.slot.update({
      where: { id: booking.slotId },
      data: { status: "BOOKED", lockedBy: null, lockedUntil: null }
    });

    await tx.ownerEarning.upsert({
      where: { bookingId: booking.id },
      update: { ...ownerEarning, courtId: booking.courtId, paymentId: booking.payment.id, status: "PENDING" },
      create: {
        ownerId: booking.slot.court.ownerId,
        courtId: booking.courtId,
        bookingId: booking.id,
        paymentId: booking.payment.id,
        ...ownerEarning,
        status: "PENDING"
      }
    });

    return updatedBooking;
  });

  await Promise.all([
    createAuditLog({
      userId,
      action: AUDIT_ACTIONS.PAYMENT_VERIFIED,
      entity: "payment",
      entityId: booking.payment.id,
      metadata: { razorpayPaymentId: razorpay_payment_id },
      req
    }),
    createAuditLog({
      userId,
      action: AUDIT_ACTIONS.BOOKING_CONFIRMED,
      entity: "booking",
      entityId: booking.id,
      metadata: { slotId: booking.slotId },
      req
    }),
    createNotification({
      userId,
      title: "Booking confirmed",
      message: `Your booking for ${booking.slot.court.name} is confirmed.`,
      type: NOTIFICATION_TYPES.BOOKING_CONFIRMED
    }),
    createNotification({
      userId,
      title: "Payment successful",
      message: "Your payment has been verified successfully.",
      type: NOTIFICATION_TYPES.PAYMENT_SUCCESS
    }),
    sendBookingConfirmationEmail({
      to: booking.user.email,
      bookingId: booking.id,
      courtName: booking.slot.court.name,
      slotDate: booking.slot.date.toISOString().split("T")[0],
      slotTime: `${booking.slot.startTime.toTimeString().slice(0, 5)} - ${booking.slot.endTime.toTimeString().slice(0, 5)}`,
      amount: Number(booking.payment.finalAmount),
      otp: checkInOtp,
      qrToken
    })
  ]);

  res.json({
    success: true,
    message: "Booking confirmed successfully",
    data: { booking: confirmedBooking, checkInOtp, qrToken }
  });
};

export const expireHolds = async (_req: Request, res: Response) => {
  const expiredCount = await releaseExpiredPendingBookings();
  res.json({ success: true, message: `Expired ${expiredCount} booking holds`, data: { expiredCount } });
};

export const myBookings = async (req: Request, res: Response) => {
  const data = await prisma.booking.findMany({
    where: { userId: req.user!.id },
    include: { court: true, slot: true, payment: { include: { refund: true } }, refund: true },
    orderBy: { createdAt: "desc" }
  });
  res.json({ success: true, message: "Bookings fetched successfully", data });
};

function cancellationAmounts(booking: { court: { cancellationChargePercent?: number | null }; payment: { amount: any; finalAmount: any; status: string } | null }) {
  const percent = booking.court.cancellationChargePercent ?? 10;
  const paid = booking.payment?.status === "SUCCESS";
  const paidAmount = paid ? Number(booking.payment?.finalAmount ?? booking.payment?.amount ?? 0) : 0;
  const cancellationCharge = paid ? Math.round((paidAmount * percent) / 100) : 0;
  const refundAmount = Math.max(0, paidAmount - cancellationCharge);
  return {
    paidAmount,
    cancellationChargePercent: percent,
    cancellationCharge,
    refundAmount,
    refundStatus: refundAmount > 0 ? "PENDING_OWNER_REFUND" : "NO_REFUND_NEEDED"
  };
}

export const cancelBookingPreview = async (req: Request, res: Response) => {
  const bookingId = String(req.params.id);
  const userId = req.user!.id;
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payment: true, slot: true, court: true }
  });
  if (!booking) throw new AppError("Booking not found", 404);
  if (booking.userId !== userId) throw new AppError("Unauthorized access to booking", 403);
  if (!["CONFIRMED", "PENDING_PAYMENT"].includes(booking.status)) throw new AppError("This booking cannot be cancelled", 400);

  res.json({ success: true, message: "Cancellation preview fetched successfully", data: cancellationAmounts(booking) });
};

export const cancelBooking = async (req: Request, res: Response) => {
  const bookingId = String(req.params.id);
  const userId = req.user!.id;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payment: true, slot: true, court: true }
  });
  if (!booking) throw new AppError("Booking not found", 404);
  if (booking.userId !== userId) throw new AppError("Unauthorized access to booking", 403);
  if (!["CONFIRMED", "PENDING_PAYMENT"].includes(booking.status)) throw new AppError("Only confirmed or pending payment bookings can be cancelled", 400);
  if (!booking.payment) throw new AppError("Payment not found", 404);

  const amounts = cancellationAmounts(booking);

  const refundRecord = await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.upsert({
      where: { bookingId: booking.id },
      update: {
        amount: amounts.refundAmount,
        cancellationCharge: amounts.cancellationCharge,
        cancellationChargePercent: amounts.cancellationChargePercent,
        status: amounts.refundAmount > 0 ? "REQUESTED" : "REJECTED",
        reason: amounts.refundAmount > 0 ? "User cancellation - pending owner refund" : "User cancellation - no refund needed",
        gatewayRefundId: null
      },
      create: {
        paymentId: booking.payment!.id,
        bookingId: booking.id,
        amount: amounts.refundAmount,
        cancellationCharge: amounts.cancellationCharge,
        cancellationChargePercent: amounts.cancellationChargePercent,
        status: amounts.refundAmount > 0 ? "REQUESTED" : "REJECTED",
        reason: amounts.refundAmount > 0 ? "User cancellation - pending owner refund" : "User cancellation - no refund needed",
        gatewayRefundId: null,
        userId
      }
    });

    await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
    if (amounts.refundAmount > 0) {
      await tx.payment.update({ where: { id: booking.payment!.id }, data: { status: "REFUND_PENDING" } });
    }
    await tx.slot.update({ where: { id: booking.slotId }, data: { status: "AVAILABLE", lockedBy: null, lockedUntil: null } });

    return refund;
  });

  await Promise.all([
    createAuditLog({ userId, action: AUDIT_ACTIONS.USER_CANCELLED_BOOKING, entity: "booking", entityId: booking.id, metadata: { bookingId: booking.id, courtId: booking.courtId, ...amounts }, req }),
    createAuditLog({ userId, action: AUDIT_ACTIONS.BOOKING_CANCELLED, entity: "booking", entityId: booking.id, req }),
    createAuditLog({ userId, action: AUDIT_ACTIONS.REFUND_CALCULATED, entity: "refund", entityId: refundRecord.id, metadata: { bookingId: booking.id, courtId: booking.courtId, ...amounts }, req }),
    ...(amounts.refundAmount > 0
      ? [
          createAuditLog({
            userId,
            action: AUDIT_ACTIONS.REFUND_INITIATED,
            entity: "refund",
            entityId: refundRecord.id,
            metadata: { bookingId: booking.id, courtId: booking.courtId, ...amounts },
            req
          }),
          createAuditLog({
            userId,
            action: AUDIT_ACTIONS.OWNER_REFUND_PENDING,
            entity: "refund",
            entityId: refundRecord.id,
            metadata: { bookingId: booking.id, courtId: booking.courtId, ownerId: booking.court.ownerId, ...amounts },
            req
          }),
          createNotification({
            userId,
            title: "Refund pending",
            message: `Refund of Rs. ${amounts.refundAmount} is pending owner processing. Cancellation charge Rs. ${amounts.cancellationCharge} was deducted.`,
            type: NOTIFICATION_TYPES.REFUND_INITIATED
          })
        ]
      : []),
    createNotification({
      userId,
      title: "Booking cancelled",
      message: `Your booking has been cancelled. Refund amount: Rs. ${amounts.refundAmount}.`,
      type: NOTIFICATION_TYPES.BOOKING_CANCELLED
    })
  ]);

  res.json({
    success: true,
    message: "Booking cancelled successfully",
    data: {
      bookingId: booking.id,
      ...amounts
    }
  });
};
