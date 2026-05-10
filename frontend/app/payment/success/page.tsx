"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import BackButton from "@/components/ui/BackButton";

type ConfirmedPayload = {
  booking?: {
    id: string;
    checkInOtp?: string;
    qrToken?: string;
    court?: { name: string };
    slot?: { startTime: string; endTime: string };
    payment?: { finalAmount: number; status: string };
  };
  checkInOtp?: string;
  qrToken?: string;
};

export default function PaymentSuccessPage() {
  const [payload, setPayload] = useState<ConfirmedPayload | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("lastConfirmedBooking");
    if (raw) setPayload(JSON.parse(raw));
  }, []);

  const otp = payload?.checkInOtp ?? payload?.booking?.checkInOtp;
  const qrToken = payload?.qrToken ?? payload?.booking?.qrToken;

  return (
    <main className="page-shell">
      <BackButton fallback="/my-bookings" />
      <div className="surface-card">
        <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Payment Successful</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Your booking has been confirmed.</p>

        {payload?.booking && (
          <div className="mt-6 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <p className="font-semibold text-slate-950 dark:text-white">{payload.booking.court?.name ?? "Confirmed court booking"}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Booking ID: {payload.booking.id}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Payment: {payload.booking.payment?.status ?? "SUCCESS"}</p>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {otp && (
            <div className="rounded-lg bg-blue-50 p-4 text-blue-900">
              <p className="text-sm font-semibold">Check-in OTP</p>
              <p className="mt-2 font-mono text-3xl font-bold">{otp}</p>
            </div>
          )}
          {qrToken && (
            <div className="rounded-lg bg-emerald-50 p-4 text-center text-emerald-900">
              <p className="mb-3 text-sm font-semibold">Check-in QR</p>
              <div className="inline-block rounded bg-white p-3">
                <QRCodeCanvas value={qrToken} size={128} />
              </div>
            </div>
          )}
        </div>

        <Link href="/my-bookings" className="btn-primary mt-6">View My Bookings</Link>
      </div>
    </main>
  );
}
