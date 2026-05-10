import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
});

export interface BookingConfirmationEmailData {
  to: string;
  bookingId: string;
  courtName: string;
  slotDate: string;
  slotTime: string;
  amount: number;
  otp?: string;
  qrToken?: string;
}

export async function sendBookingConfirmationEmail(data: BookingConfirmationEmailData) {
  try {
    const mailOptions = {
      from: env.EMAIL_USER,
      to: data.to,
      subject: "Booking Confirmed - Badminton Court",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Booking Confirmed!</h2>
          <p>Dear Customer,</p>
          <p>Your badminton court booking has been confirmed. Here are the details:</p>

          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1e293b;">Booking Details</h3>
            <p><strong>Booking ID:</strong> ${data.bookingId}</p>
            <p><strong>Court:</strong> ${data.courtName}</p>
            <p><strong>Date:</strong> ${data.slotDate}</p>
            <p><strong>Time:</strong> ${data.slotTime}</p>
            <p><strong>Amount Paid:</strong> ₹${data.amount}</p>
            ${data.otp ? `<p><strong>Check-in OTP:</strong> ${data.otp}</p>` : ""}
          </div>

          ${data.qrToken ? `
            <div style="text-align: center; margin: 20px 0;">
              <p>Please show this QR code at the venue for check-in:</p>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.qrToken)}" alt="QR Code" style="max-width: 200px;" />
            </div>
          ` : ""}

          <p style="color: #dc2626; font-weight: bold;">
            Please arrive 15 minutes before your booking time.
          </p>

          <p>Thank you for choosing our platform!</p>
          <p>Best regards,<br>Badminton Court Booking Team</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending booking confirmation email:", error);
    // Don't throw error to avoid breaking main flow
  }
}
