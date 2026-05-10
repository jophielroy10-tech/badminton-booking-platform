"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import toast from "react-hot-toast";
import BackButton from "@/components/ui/BackButton";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import { Skeleton } from "@/components/ui/Skeleton";
import { getPaymentDetails, submitUpiPayment, type UserPaymentDetails } from "@/lib/api";
import { getCourtPrimaryImage, getImageUrl } from "@/lib/image";

export default function PaymentDetailsPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const [details, setDetails] = useState<UserPaymentDetails | null>(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function load() {
    const response = await getPaymentDetails(params.bookingId);
    setDetails(response.data ?? null);
  }

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load payment details"))
      .finally(() => setLoading(false));
  }, [params.bookingId]);

  async function submit() {
    if (!details) return;
    setSubmitting(true);
    setError("");
    try {
      await submitUpiPayment({ paymentId: details.payment.id, utrNumber });
      toast.success("Payment submitted. Waiting for owner confirmation.");
      setSubmitted(true);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to submit UTR";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <BackButton fallback="/courts" />
      <h1 className="text-2xl font-bold text-slate-950 dark:text-white sm:text-3xl">Payment Details</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Pay the court owner directly by UPI, then submit your UTR for verification.</p>

      {loading && <div className="mt-6 surface-card"><Skeleton className="h-72 w-full" /></div>}
      {error && <p className="mt-6 rounded-md bg-red-50 p-4 text-red-700">{error}</p>}

      {!loading && details && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="surface-card">
            <div className="grid gap-5 md:grid-cols-[220px_1fr]">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-100 md:aspect-square">
                <ImageWithFallback src={getCourtPrimaryImage(details.court)} alt={details.court.name} />
              </div>
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold text-slate-950 dark:text-white sm:text-2xl">{details.court.name}</h2>
                <p className="mt-2 break-words text-sm text-slate-600 dark:text-slate-300">{details.court.address}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Info label="Slot date" value={new Date(details.slot.date).toLocaleDateString("en-IN")} />
                  <Info label="Time" value={`${time(details.slot.startTime)} - ${time(details.slot.endTime)}`} />
                  <Info label="Amount" value={`Rs. ${details.payment.finalAmount}`} />
                  <Info label="Status" value={details.payment.status} />
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="font-semibold text-slate-950 dark:text-white">Owner UPI Payment</h3>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase text-slate-500">Owner UPI ID</p>
                  <p className="break-all font-semibold text-slate-950 dark:text-white">{details.court.upiId}</p>
                </div>
                <button className="btn-secondary w-full sm:w-auto" onClick={() => navigator.clipboard?.writeText(details.court.upiId || "")}>Copy UPI</button>
              </div>
              {details.upiLink && <a className="btn-primary mt-4 w-full sm:w-auto" href={details.upiLink}>Open UPI App</a>}
            </div>

            <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              After payment, enter your UTR. Booking will be confirmed after owner verifies payment.
            </p>

            {(submitted || details.payment.status === "USER_SUBMITTED") && (
              <p className="mt-4 rounded-md bg-amber-50 p-4 font-medium text-amber-800">Payment submitted. Waiting for owner confirmation.</p>
            )}
            {details.payment.status === "SUCCESS" && <p className="mt-4 rounded-md bg-emerald-50 p-4 font-medium text-emerald-700">Payment verified. Booking confirmed.</p>}
            {details.payment.status === "OWNER_REJECTED" && <p className="mt-4 rounded-md bg-red-50 p-4 font-medium text-red-700">Payment was rejected by owner.</p>}

            {details.payment.status === "PENDING" && (
              <div className="mt-6 grid gap-3">
                <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  UTR / Transaction ID
                  <input className="field" placeholder="Enter UTR after payment" value={utrNumber} onChange={(event) => setUtrNumber(event.target.value.toUpperCase())} />
                </label>
                <button className="btn-primary w-full sm:w-auto" disabled={submitting || !/^[A-Z0-9]{8,30}$/.test(utrNumber)} onClick={submit}>
                  {submitting ? "Submitting..." : "Submit Payment Proof"}
                </button>
              </div>
            )}
          </section>

          <aside className="h-fit surface-card">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Scan QR</h2>
            <div className="relative mx-auto mt-4 flex aspect-square w-56 max-w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 sm:w-64">
              {details.court.upiQrImageUrl ? (
                <ImageWithFallback src={getImageUrl(details.court.upiQrImageUrl)} alt={`${details.court.name} UPI QR`} placeholder="No QR uploaded" contain />
              ) : (
                <QRCodeCanvas value={details.upiLink} size={220} />
              )}
            </div>
            <button className="btn-secondary mt-4 w-full" onClick={() => router.push("/my-bookings")}>View My Bookings</button>
          </aside>
        </div>
      )}
    </main>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function time(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
