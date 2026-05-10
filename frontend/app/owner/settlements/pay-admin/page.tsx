"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import toast from "react-hot-toast";
import BackButton from "@/components/ui/BackButton";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import { Skeleton } from "@/components/ui/Skeleton";
import { getOwnerPayToAdminDetails, submitOwnerPayToAdminPayment, type OwnerPayToAdminDetails } from "@/lib/api";
import { getImageUrl } from "@/lib/image";

export default function PayAdminPage() {
  return (
    <Suspense fallback={<main className="page-shell"><Skeleton className="h-64 w-full" /></main>}>
      <PayAdminContent />
    </Suspense>
  );
}

function PayAdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = (searchParams.get("type") || "DAILY").toUpperCase() as "DAILY" | "MONTHLY" | "TOTAL_PENDING";
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const month = searchParams.get("month") ? Number(searchParams.get("month")) : undefined;
  const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
  const settlementId = searchParams.get("settlementId") || undefined;
  const [details, setDetails] = useState<OwnerPayToAdminDetails | null>(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getOwnerPayToAdminDetails({ type, date, month, year, settlementId })
      .then((response) => setDetails(response.data ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load admin payment details"))
      .finally(() => setLoading(false));
  }, [type, date, month, year, settlementId]);

  async function submit() {
    if (!details) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await submitOwnerPayToAdminPayment({
        type,
        settlementId: details.settlement.id,
        utrNumber
      });
      setDetails((current) => current ? { ...current, settlement: { ...current.settlement, status: "SUBMITTED", utrNumber, submittedAt: new Date().toISOString() }, payable: { ...current.payable, status: "SUBMITTED", utrNumber, submittedAt: new Date().toISOString() } } : current);
      setSubmitted(true);
      toast.success(response.message || "Payment proof submitted. Waiting for admin verification.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to submit payment proof";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <BackButton fallback="/owner/settlements" />
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Pay Settlement to Admin</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Pay the platform commission to the admin UPI and submit your UTR for verification.</p>

      {loading && <div className="mt-6 surface-card"><Skeleton className="h-64 w-full" /></div>}
      {error && <p className="mt-6 rounded-md bg-red-50 p-4 text-red-700">{error}</p>}

      {!loading && details && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="surface-card">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Payment Details</h2>
              <span className="rounded bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">{settlementTitle(details.settlement.type)}</span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Info label="Admin / Platform UPI ID" value={details.platform.upiId || "Not configured"} />
              <Info label="Account name" value={details.platform.accountName || "Badminton Platform"} />
              <Info label="Amount to pay" value={`Rs. ${details.settlement.totalPayableToAdmin}`} />
              <Info label="Settlement range" value={rangeLabel(details.settlement)} />
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button className="btn-secondary w-full sm:w-auto" disabled={!details.platform.upiId} onClick={() => navigator.clipboard?.writeText(details.platform.upiId || "")}>Copy UPI ID</button>
              {details.upiLink && <a className="btn-primary w-full sm:w-auto" href={details.upiLink}>Open UPI App</a>}
            </div>

            <div className="mt-6 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="font-semibold text-slate-950 dark:text-white">Settlement Breakdown</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Info label="Gross revenue" value={`Rs. ${details.settlement.grossAmount}`} />
                <Info label="Platform commission" value={`Rs. ${details.settlement.commissionAmount}`} />
                <Info label="Platform fee" value={`Rs. ${details.settlement.platformFee}`} />
                <Info label="GST" value={`Rs. ${details.settlement.gst}`} />
                <Info label="Total payable to admin" value={`Rs. ${details.settlement.totalPayableToAdmin}`} />
                <Info label="Payment status" value={details.settlement.status} />
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              Pay the settlement amount to the admin/platform UPI shown above. Admin will verify your UTR before marking settlement as paid.
            </div>

            {details.settlement.totalPayableToAdmin <= 0 && <p className="mt-4 rounded-md bg-emerald-50 p-4 font-medium text-emerald-700">No pending amount to pay.</p>}
            {(submitted || details.settlement.status === "SUBMITTED") && (
              <p className="mt-4 rounded-md bg-amber-50 p-4 font-medium text-amber-800">Submitted - Waiting for Admin Verification</p>
            )}
            {details.settlement.status === "VERIFIED" && <p className="mt-4 rounded-md bg-emerald-50 p-4 font-medium text-emerald-700">Paid / Verified</p>}
            {details.settlement.status === "REJECTED" && details.settlement.rejectionReason && (
              <p className="mt-4 rounded-md bg-red-50 p-4 font-medium text-red-700">Rejected: {details.settlement.rejectionReason}</p>
            )}

            {details.settlement.totalPayableToAdmin > 0 && details.settlement.status !== "SUBMITTED" && details.settlement.status !== "VERIFIED" && (
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
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Admin QR Code</h2>
            <div className="relative mx-auto mt-4 flex aspect-square w-56 max-w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 sm:w-64">
              {details.platform.qrImageUrl ? (
                <ImageWithFallback src={getImageUrl(details.platform.qrImageUrl)} alt="Admin platform QR" placeholder="No QR uploaded by admin" contain />
              ) : details.upiLink ? (
                <QRCodeCanvas value={details.upiLink} size={220} />
              ) : (
                <div className="p-4 text-center text-sm font-medium text-slate-500">Admin payment details are not configured.</div>
              )}
            </div>
            {!details.platform.qrImageUrl && <p className="mt-3 text-sm text-slate-500">No QR uploaded by admin</p>}
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
      <p className="mt-1 break-words font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function settlementTitle(type: string) {
  if (type === "MONTHLY") return "Monthly Settlement";
  if (type === "TOTAL_PENDING") return "Total Pending Settlement";
  return "Daily Settlement";
}

function rangeLabel(settlement: { type: string; date: string; fromDate?: string; toDate?: string }) {
  if (settlement.type === "DAILY") return new Date(settlement.date).toLocaleDateString("en-IN");
  if (!settlement.fromDate || !settlement.toDate) return settlement.date;
  return `${new Date(settlement.fromDate).toLocaleDateString("en-IN")} - ${new Date(settlement.toDate).toLocaleDateString("en-IN")}`;
}
