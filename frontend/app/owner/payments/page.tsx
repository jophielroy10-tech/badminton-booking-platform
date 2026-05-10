"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getOwnerPayments, getOwnerPlatformPaymentSettings, rejectOwnerUpiPayment, verifyOwnerUpiPayment, type Payment, type PlatformSettings } from "@/lib/api";
import BackButton from "@/components/ui/BackButton";
import { BookingCardSkeleton } from "@/components/ui/Skeleton";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import { getImageUrl } from "@/lib/image";

export default function OwnerPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [platformSettings, setPlatformSettings] = useState<Pick<PlatformSettings, "platformUpiId" | "platformQrImageUrl" | "platformAccountName"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    const [response, settingsResponse] = await Promise.all([getOwnerPayments(), getOwnerPlatformPaymentSettings()]);
    setPayments(response.data ?? []);
    setPlatformSettings(settingsResponse.data ?? null);
  }

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load payments"))
      .finally(() => setLoading(false));
  }, []);

  async function verify(id: string) {
    try {
      await verifyOwnerUpiPayment(id);
      toast.success("Payment verified");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to verify payment");
    }
  }

  async function reject(id: string) {
    const reason = window.prompt("Reason for rejection") || "Payment not found";
    try {
      await rejectOwnerUpiPayment(id, reason);
      toast.success("Payment rejected");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to reject payment");
    }
  }

  return (
    <main className="page-shell">
      <BackButton fallback="/owner/dashboard" />
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Owner Payments</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Review direct UPI payment submissions for your courts.</p>
      {loading && <div className="mt-6 grid gap-4"><BookingCardSkeleton /><BookingCardSkeleton /></div>}
      {error && <p className="mt-6 rounded-md bg-red-50 p-4 text-red-700">{error}</p>}
      {!loading && platformSettings && (
        <section className="mt-6 surface-card">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Platform settlement/payment details</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Configured by admin. This does not replace court owner UPI for direct user bookings.</p>
          <p className="mt-3 break-all text-sm">Platform UPI: <span className="font-semibold">{platformSettings.platformUpiId || "Not configured"}</span></p>
          {platformSettings.platformQrImageUrl && (
            <div className="relative mt-4 h-44 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800">
              <ImageWithFallback src={getImageUrl(platformSettings.platformQrImageUrl)} alt="Platform QR" placeholder="No QR uploaded" contain />
            </div>
          )}
          {!platformSettings.platformQrImageUrl && <p className="mt-4 text-sm font-medium text-slate-500">No platform QR uploaded</p>}
        </section>
      )}
      {!loading && !error && payments.length === 0 && <p className="mt-6 surface-card text-slate-600 dark:text-slate-300">No UPI payment requests found.</p>}
      <div className="mt-6 grid gap-4">
        {payments.map((payment) => {
          const booking = payment.booking;
          return (
            <article key={payment.id} className="surface-card">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">{payment.status}</span>
                    <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-bold uppercase text-emerald-700">Rs. {payment.finalAmount}</span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{booking?.court?.name || "Court"}</h2>
                  <p className="mt-1 break-all text-sm text-slate-600 dark:text-slate-300">{payment.user?.name} - {payment.user?.email}</p>
                  {booking?.slot && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{new Date(booking.slot.startTime).toLocaleString()} - {new Date(booking.slot.endTime).toLocaleTimeString()}</p>}
                  <p className="mt-2 break-all text-sm">UPI ID: <span className="font-semibold">{payment.upiId || "-"}</span></p>
                  <p className="break-all text-sm">UTR: <span className="font-semibold">{payment.utrNumber || "-"}</span></p>
                </div>
                {payment.status === "USER_SUBMITTED" && (
                  <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                    <button className="btn-primary w-full sm:w-auto lg:w-full" onClick={() => verify(payment.id)}>Confirm</button>
                    <button className="btn-secondary w-full sm:w-auto lg:w-full" onClick={() => reject(payment.id)}>Reject</button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
