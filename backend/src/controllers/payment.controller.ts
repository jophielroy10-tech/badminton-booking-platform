import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.middleware.js";
import { AUDIT_ACTIONS, createAuditLog } from "../utils/audit.js";
import { NOTIFICATION_TYPES, createNotification } from "../utils/notification.js";
import { verifyWebhookSignature } from "../utils/razorpay.js";
import { calculateOwnerEarning } from "../utils/platformSettings.js";
import { normalizeCourtImages } from "../utils/imageUrl.js";

const SLOT_UNAVAILABLE_MESSAGE = "Slot is already booked or unavailable.";

type RazorpayPaymentEntity = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
};

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

export const razorpayWebhook = async (req: Request, res: Response) => {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);

  if (!signature || Array.isArray(signature) || !verifyWebhookSignature(rawBody, signature)) {
    throw new AppError("Invalid webhook signature", 400);
  }

  const payload = JSON.parse(rawBody);
  const paymentEntity = payload.payload?.payment?.entity;
  const refundEntity = payload.payload?.refund?.entity;

  if (payload.event === "payment.captured" && paymentEntity) {
    await handlePaymentCaptured(paymentEntity, req);
  }

  if (payload.event === "payment.failed" && paymentEntity) {
    await handlePaymentFailed(paymentEntity, req);
  }

  if (payload.event === "refund.processed" && refundEntity) {
    await handleRefundProcessed(refundEntity, req);
  }

  res.json({ status: "ok" });
};

export const submitUpiPayment = async (req: Request, res: Response) => {
  const paymentId = String(req.body.paymentId || "").trim();
  const utrNumber = String(req.body.utrNumber || "").trim().toUpperCase();
  if (!paymentId) throw new AppError("Payment ID is required", 400);
  if (!/^[A-Z0-9]{8,30}$/.test(utrNumber)) throw new AppError("UTR / transaction ID must be 8 to 30 letters or numbers", 400);

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: { include: { slot: true, court: true } } }
  });
  if (!payment || !payment.booking) throw new AppError("Payment not found", 404);
  if (payment.userId !== req.user!.id) throw new AppError("You can submit UTR only for your payment", 403);
  if (payment.provider !== "DIRECT_UPI") throw new AppError("Only direct UPI payments can be submitted here", 400);
  if (payment.booking.status !== "PENDING_PAYMENT") throw new AppError("Booking is not pending payment", 400);
  if (payment.booking.expiresAt && payment.booking.expiresAt <= new Date()) throw new AppError("Booking hold has expired", 400);
  const [existingUtr, existingOwnerSettlementUtr] = await Promise.all([
    prisma.payment.findFirst({ where: { utrNumber, id: { not: payment.id } }, select: { id: true } }),
    prisma.ownerSettlement.findFirst({ where: { ownerPaymentUtr: utrNumber }, select: { id: true } })
  ]);
  if (existingUtr || existingOwnerSettlementUtr) {
    await createAuditLog({
      userId: req.user!.id,
      action: AUDIT_ACTIONS.USER_SUBMITTED_DUPLICATE_UTR_ATTEMPT,
      entity: "payment",
      entityId: payment.id,
      metadata: { paymentId: payment.id, bookingId: payment.bookingId },
      req
    });
    throw new AppError("This UTR / transaction ID has already been used.", 409);
  }

  const data = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "USER_SUBMITTED", utrNumber, userSubmittedAt: new Date() },
    include: { booking: { include: { court: true, slot: true } } }
  });

  await createAuditLog({
    userId: req.user!.id,
    action: AUDIT_ACTIONS.USER_SUBMITTED_UPI_PAYMENT,
    entity: "payment",
    entityId: payment.id,
    metadata: { bookingId: payment.bookingId, courtId: payment.booking.courtId, provider: "DIRECT_UPI" },
    req
  });

  res.json({ success: true, message: "UPI payment submitted for owner verification", data });
};

export const paymentDetails = async (req: Request, res: Response) => {
  const booking = await prisma.booking.findUnique({
    where: { id: String(req.params.bookingId) },
    include: {
      court: { include: { images: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } },
      slot: true,
      payment: true
    }
  });
  if (!booking) throw new AppError("Booking not found", 404);
  if (booking.userId !== req.user!.id) throw new AppError("You can view only your own payment details", 403);
  if (!booking.payment) throw new AppError("Payment not found", 404);
  if (booking.payment.provider !== "DIRECT_UPI") throw new AppError("Only direct UPI payment details are available here", 400);
  if (!booking.court.upiId) throw new AppError("Court owner payment details are missing", 400);

  const amount = Number(booking.payment.finalAmount);
  res.json({
    success: true,
    message: "Payment details fetched successfully",
    data: {
      booking: {
        id: booking.id,
        status: booking.status,
        expiresAt: booking.expiresAt
      },
      court: normalizeCourtImages(req, booking.court),
      slot: {
        date: booking.slot.date,
        startTime: booking.slot.startTime,
        endTime: booking.slot.endTime
      },
      payment: {
        id: booking.payment.id,
        amount: Number(booking.payment.amount),
        finalAmount: amount,
        status: booking.payment.status,
        provider: booking.payment.provider,
        utrNumber: booking.payment.utrNumber
      },
      upiLink: createUpiLink({ upiId: booking.court.upiId, courtName: booking.court.name, amount, bookingId: booking.id })
    }
  });
};

async function handlePaymentCaptured(entity: RazorpayPaymentEntity, req: Request) {
  const payment = await prisma.payment.findFirst({
    where: { razorpayOrderId: entity.order_id },
    include: { booking: { include: { slot: { include: { court: true } }, user: true } } }
  });
  if (!payment || payment.status === "SUCCESS") return;
  if (!payment.booking || payment.booking.status !== "PENDING") return;
  if (Number(entity.amount) !== Number(payment.finalAmount) * 100 || entity.currency !== "INR" || entity.status !== "captured") return;

  const checkInOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const qrToken = uuidv4();
  const ownerEarning = await calculateOwnerEarning(Number(payment.finalAmount), {
    platformFee: Number(payment.platformFee),
    gst: Number(payment.gst),
    paymentId: payment.id,
    courtId: payment.booking.courtId
  });

  await prisma.$transaction(async (tx) => {
    const bookedSlot = await tx.slot.updateMany({
      where: {
        id: payment.booking.slotId,
        status: "HOLD",
        lockedBy: payment.userId,
        lockedUntil: { gt: new Date() }
      },
      data: { status: "BOOKED", lockedBy: null, lockedUntil: null }
    });

    if (bookedSlot.count !== 1) {
      throw new AppError(SLOT_UNAVAILABLE_MESSAGE, 409);
    }

    await tx.booking.update({
      where: { id: payment.bookingId },
      data: { status: "CONFIRMED", checkInOtp, qrToken }
    });
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCESS", razorpayPaymentId: entity.id }
    });
    await tx.ownerEarning.upsert({
      where: { bookingId: payment.bookingId },
      update: { ...ownerEarning, courtId: payment.booking.courtId, paymentId: payment.id, status: "PENDING" },
      create: {
        ownerId: payment.booking.slot.court.ownerId,
        courtId: payment.booking.courtId,
        bookingId: payment.bookingId,
        paymentId: payment.id,
        ...ownerEarning,
        status: "PENDING"
      }
    });
  });

  await Promise.all([
    createAuditLog({
      userId: payment.userId,
      action: AUDIT_ACTIONS.WEBHOOK_PAYMENT_CAPTURED,
      entity: "payment",
      entityId: payment.id,
      metadata: { razorpayPaymentId: entity.id, source: "webhook" },
      req
    }),
    createAuditLog({
      userId: payment.userId,
      action: AUDIT_ACTIONS.PAYMENT_VERIFIED,
      entity: "payment",
      entityId: payment.id,
      metadata: { razorpayPaymentId: entity.id, source: "webhook" },
      req
    }),
    createAuditLog({
      userId: payment.userId,
      action: AUDIT_ACTIONS.BOOKING_CONFIRMED,
      entity: "booking",
      entityId: payment.bookingId,
      metadata: { source: "webhook" },
      req
    }),
    createNotification({
      userId: payment.userId,
      title: "Payment successful",
      message: "Your booking payment was confirmed.",
      type: NOTIFICATION_TYPES.PAYMENT_SUCCESS
    })
  ]);
}

async function handlePaymentFailed(entity: RazorpayPaymentEntity, req: Request) {
  const payment = await prisma.payment.findFirst({
    where: { razorpayOrderId: entity.order_id },
    include: { booking: true }
  });
  if (!payment || payment.status !== "PENDING" || !payment.booking) return;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", razorpayPaymentId: entity.id } });
    await tx.booking.update({ where: { id: payment.bookingId }, data: { status: "FAILED" } });
    await tx.slot.updateMany({
      where: { id: payment.booking.slotId, status: "HOLD", lockedBy: payment.userId },
      data: { status: "AVAILABLE", lockedBy: null, lockedUntil: null }
    });
  });

  await Promise.all([
    createAuditLog({
      userId: payment.userId,
      action: AUDIT_ACTIONS.WEBHOOK_PAYMENT_FAILED,
      entity: "payment",
      entityId: payment.id,
      metadata: { razorpayPaymentId: entity.id, source: "webhook" },
      req
    }),
    createAuditLog({
      userId: payment.userId,
      action: AUDIT_ACTIONS.PAYMENT_FAILED,
      entity: "payment",
      entityId: payment.id,
      metadata: { source: "webhook" },
      req
    }),
    createNotification({
      userId: payment.userId,
      title: "Payment failed",
      message: "Your payment could not be completed. Please try again.",
      type: NOTIFICATION_TYPES.BOOKING_CANCELLED
    })
  ]);
}

async function handleRefundProcessed(entity: any, req: Request) {
  const refund = await prisma.refund.findFirst({
    where: { gatewayRefundId: entity.id },
    include: { payment: true }
  });
  if (!refund || refund.status === "PROCESSED") return;

  const isFullRefund = Number(refund.amount) >= Number(refund.payment.finalAmount);
  await prisma.$transaction([
    prisma.refund.update({ where: { id: refund.id }, data: { status: "PROCESSED" } }),
    prisma.payment.update({
      where: { id: refund.paymentId },
      data: { status: isFullRefund ? "REFUNDED" : "REFUND_PENDING" }
    })
  ]);
  await createAuditLog({
    userId: refund.userId,
    action: AUDIT_ACTIONS.WEBHOOK_REFUND_PROCESSED,
    entity: "refund",
    entityId: refund.id,
    metadata: { gatewayRefundId: entity.id, amount: Number(refund.amount) },
    req
  });
}
