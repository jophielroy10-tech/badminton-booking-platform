"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import BackButton from "@/components/ui/BackButton";
import { BookingCardSkeleton } from "@/components/ui/Skeleton";
import { getOwnerEarnings, getOwnerSettlementSummary, getOwnerSettlements, type OwnerEarning, type OwnerSettlement, type OwnerSettlementSummaryBlock, type OwnerSettlementSummaryData } from "@/lib/api";

export default function OwnerSettlementsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<OwnerSettlementSummaryData | null>(null);
  const [earnings, setEarnings] = useState<OwnerEarning[]>([]);
  const [settlements, setSettlements] = useState<OwnerSettlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getOwnerSettlementSummary(), getOwnerEarnings(), getOwnerSettlements()])
      .then(([summaryResponse, earningsResponse, settlementsResponse]) => {
        setSummary(summaryResponse.data ?? null);
        setEarnings(earningsResponse.data ?? []);
        setSettlements(settlementsResponse.data ?? []);
      })
      .catch(() => toast.error("Unable to load settlements"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page-shell">
      <BackButton fallback="/owner/dashboard" />
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Settlements</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-300">Track admin payable commission, missed payments, and booking-wise earnings.</p>
      {loading && <div className="mt-6 grid gap-4"><BookingCardSkeleton /><BookingCardSkeleton /></div>}

      {!loading && summary && (
        <>
          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <SettlementPayCard
              title="Daily Settlement"
              buttonText="Pay Daily Now"
              block={summary.daily}
              rows={[
                ["Today's Gross", summary.daily.grossAmount],
                ["Admin Payable", summary.daily.totalPayable],
                ["Paid", summary.daily.paidAmount],
                ["Pending", summary.daily.pendingAmount]
              ]}
              onPay={() => router.push("/owner/settlements/pay-admin?type=DAILY")}
            />
            <SettlementPayCard
              title="Monthly Settlement"
              buttonText="Pay Monthly Now"
              block={summary.monthly}
              rows={[
                ["This Month Gross", summary.monthly.grossAmount],
                ["Admin Payable", summary.monthly.totalPayable],
                ["Paid", summary.monthly.paidAmount],
                ["Pending", summary.monthly.pendingAmount]
              ]}
              onPay={() => router.push("/owner/settlements/pay-admin?type=MONTHLY")}
            />
            <SettlementPayCard
              title="Total Pending Till Now"
              buttonText="Pay All Pending Now"
              block={summary.totalPending}
              rows={[
                ["Total Gross", summary.totalPending.grossAmount],
                ["Total Admin Payable", summary.totalPending.totalPayable],
                ["Total Paid", summary.totalPending.paidAmount],
                ["Missed / Unpaid", summary.totalPending.pendingAmount]
              ]}
              onPay={() => router.push("/owner/settlements/pay-admin?type=TOTAL_PENDING")}
            />
          </section>

          {summary.totalPending.pendingAmount <= 0 && (
            <p className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 font-medium text-emerald-700">All settlements are cleared.</p>
          )}

          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Daily payable" value={`Rs. ${summary.daily.pendingAmount}`} />
            <Stat label="Monthly payable" value={`Rs. ${summary.monthly.pendingAmount}`} />
            <Stat label="Total pending payable" value={`Rs. ${summary.totalPending.pendingAmount}`} />
            <Stat label="Paid amount" value={`Rs. ${summary.totalPending.paidAmount}`} />
          </section>
        </>
      )}

      {!loading && (
        <section className="mt-6 surface-card">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Booking-wise Earnings</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[860px] w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Court</th><th>Booking</th><th>Gross</th><th>Commission</th><th>Platform fee</th><th>Net</th><th>Status</th><th>Date</th></tr></thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {earnings.map((earning) => (
                  <tr key={earning.id}>
                    <td className="py-3">{earning.court?.name ?? "-"}</td>
                    <td>{earning.bookingId.slice(0, 8)}</td>
                    <td>Rs. {earning.grossAmount}</td>
                    <td>Rs. {earning.commission}</td>
                    <td>Rs. {earning.platformFee}</td>
                    <td className="font-semibold">Rs. {earning.netAmount}</td>
                    <td><Status status={earning.status} /></td>
                    <td>{new Date(earning.createdAt).toLocaleDateString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {earnings.length === 0 && <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No confirmed booking earnings yet.</p>}
        </section>
      )}

      {!loading && (
        <section className="mt-6 surface-card">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Settlement History</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[960px] w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Type</th><th>From</th><th>To</th><th>Gross</th><th>Commission</th><th>Platform fee</th><th>Status</th><th>Payment</th><th>UTR</th></tr></thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {settlements.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3">{item.cycle}</td>
                    <td>{new Date(item.fromDate).toLocaleDateString("en-IN")}</td>
                    <td>{new Date(item.toDate).toLocaleDateString("en-IN")}</td>
                    <td>Rs. {item.grossAmount}</td>
                    <td>Rs. {item.totalCommission}</td>
                    <td>Rs. {item.totalPlatformFee}</td>
                    <td><Status status={item.status} /></td>
                    <td><Status status={item.ownerPaymentStatus || "NOT_PAID"} /></td>
                    <td>{item.ownerPaymentUtr || item.settlementUtr || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {settlements.length === 0 && <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No settlements generated yet.</p>}
        </section>
      )}
    </main>
  );
}

function SettlementPayCard({ title, buttonText, block, rows, onPay }: { title: string; buttonText: string; block: OwnerSettlementSummaryBlock; rows: Array<[string, number]>; onPay: () => void }) {
  return (
    <article className="surface-card">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
        <Status status={statusLabel(block)} />
      </div>
      <div className="mt-4 grid gap-3">
        {rows.map(([label, value]) => <InlineStat key={label} label={label} value={`Rs. ${value}`} />)}
      </div>
      {block.pendingAmount > 0 ? (
        <button className="btn-primary mt-5 w-full" onClick={onPay}>{buttonText}</button>
      ) : (
        <p className="mt-5 rounded bg-emerald-50 p-3 text-sm font-medium text-emerald-700">All settlements are cleared.</p>
      )}
    </article>
  );
}

function statusLabel(block: OwnerSettlementSummaryBlock) {
  if (block.status === "SUBMITTED") return "Waiting for Admin Verification";
  if (block.status === "VERIFIED" || block.status === "PAID") return "Paid / Verified";
  if (block.status === "REJECTED") return "Rejected - Pay Again";
  return block.pendingAmount > 0 ? "Payment Pending" : "Paid / Verified";
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="surface-card"><p className="text-sm text-slate-600 dark:text-slate-300">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</p></div>;
}

function InlineStat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-950 dark:text-white">{value}</p></div>;
}

function Status({ status }: { status: string }) {
  const style = status.includes("Waiting") || status === "SUBMITTED"
    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
    : status.includes("Rejected") || status === "REJECTED"
      ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
      : status.includes("Pending") || status === "PENDING" || status === "NOT_PAID"
        ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  return <span className={`inline-flex rounded px-2 py-1 text-xs font-bold ${style}`}>{status}</span>;
}
