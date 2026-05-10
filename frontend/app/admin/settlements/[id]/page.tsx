"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import BackButton from "@/components/ui/BackButton";
import { BookingCardSkeleton } from "@/components/ui/Skeleton";
import { getAdminSettlementDetails, rejectAdminSettlement, verifyAdminSettlement } from "@/lib/api";

export default function AdminSettlementDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const response = await getAdminSettlementDetails(params.id);
    setData(response.data);
  }

  useEffect(() => {
    load().catch(() => toast.error("Unable to load settlement")).finally(() => setLoading(false));
  }, [params.id]);

  async function verify() {
    await verifyAdminSettlement(params.id);
    toast.success("Owner commission payment verified");
    await load();
  }

  async function reject() {
    const reason = prompt("Reason for rejection");
    if (!reason) return;
    await rejectAdminSettlement(params.id, reason);
    toast.success("Owner commission payment rejected");
    await load();
  }

  if (loading) return <main className="page-shell"><BackButton fallback="/admin/settlements" /><BookingCardSkeleton /></main>;
  if (!data) return <main className="page-shell"><BackButton fallback="/admin/settlements" /><p className="surface-card">Settlement not found.</p></main>;

  const settlement = data.settlement;

  return (
    <main className="page-shell">
      <BackButton fallback="/admin/settlements" />
      <section className="surface-card">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-950 dark:text-white">{data.owner.name}</h1>
            <p className="mt-1 text-slate-600 dark:text-slate-300">{data.owner.email}</p>
            <p className="mt-2 text-sm text-slate-500">Period {settlement.month}/{settlement.year}</p>
          </div>
          <span className="rounded bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">{settlement.status}</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Revenue" value={`Rs. ${settlement.monthlyRevenue}`} />
          <Metric label="Commission" value={`${settlement.commissionPercent}%`} />
          <Metric label="Amount due" value={`Rs. ${settlement.amountDue}`} />
          <Metric label="Admin UPI snapshot" value={settlement.adminUpiIdSnapshot || "-"} />
          <Metric label="UTR" value={settlement.paymentUtr || "-"} />
          <Metric label="Submitted" value={settlement.submittedAt ? new Date(settlement.submittedAt).toLocaleString("en-IN") : "-"} />
          <Metric label="Verified" value={settlement.verifiedAt ? new Date(settlement.verifiedAt).toLocaleString("en-IN") : "-"} />
          <Metric label="Rejection" value={settlement.rejectionReason || "-"} />
        </div>
        {settlement.status === "SUBMITTED" && <div className="mt-5 flex gap-2"><button className="btn-primary" onClick={verify}>Verify</button><button className="btn-secondary" onClick={reject}>Reject</button></div>}
      </section>
      <section className="mt-6 surface-card">
        <h2 className="text-lg font-semibold">Court-wise Revenue</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.courtBreakdown.map((court: any) => <Metric key={court.courtId} label={court.courtName} value={`Rs. ${court.revenue} (${court.bookings} bookings)`} />)}
        </div>
      </section>
      <section className="mt-6 surface-card overflow-x-auto">
        <h2 className="text-lg font-semibold">Payments Included</h2>
        <table className="mt-4 min-w-[760px] w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Court</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{data.payments.map((payment: any) => <tr key={payment.id}><td className="py-3">{payment.booking.court.name}</td><td>Rs. {payment.finalAmount}</td><td>{payment.status}</td><td>{new Date(payment.createdAt).toLocaleString("en-IN")}</td></tr>)}</tbody></table>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-950 dark:text-white">{value}</p></div>;
}
