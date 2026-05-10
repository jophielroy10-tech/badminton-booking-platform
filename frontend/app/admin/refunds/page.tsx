"use client";

import { useEffect, useState } from "react";
import BackButton from "@/components/ui/BackButton";
import { apiRequest, type Refund } from "@/lib/api";

type AdminRefund = Refund & {
  user?: { id: string; name: string; email: string };
  booking?: {
    court?: { name: string; owner?: { name: string; email: string } };
    slot?: { startTime: string; endTime: string };
  };
  payment?: { finalAmount: number; status: string };
};

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<AdminRefund[]>([]);

  useEffect(() => {
    apiRequest<AdminRefund[]>("/admin/refunds").then((response) => setRefunds(response.data ?? [])).catch(() => setRefunds([]));
  }, []);

  return (
    <main className="page-shell">
      <BackButton fallback="/admin/dashboard" />
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Admin Refunds</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Review cancellation deductions and pending owner refunds.</p>
      <div className="mt-6 space-y-3">
        {refunds.map((refund) => (
          <article key={refund.id} className="surface-card">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
              <div>
                <h2 className="font-semibold text-slate-950 dark:text-white">{refund.booking?.court?.name ?? "Court"}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  User: {refund.user?.name ?? "User"} · Owner: {refund.booking?.court?.owner?.name ?? "Owner"}
                </p>
                {refund.booking?.slot && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {new Date(refund.booking.slot.startTime).toLocaleString("en-IN")} - {new Date(refund.booking.slot.endTime).toLocaleTimeString("en-IN")}
                  </p>
                )}
              </div>
              <div className="text-sm text-slate-700 dark:text-slate-300 lg:text-right">
                <p>Paid amount: Rs. {refund.payment?.finalAmount ?? 0}</p>
                <p>Cancellation %: {refund.cancellationChargePercent ?? 10}%</p>
                <p>Cancellation charge: Rs. {refund.cancellationCharge ?? 0}</p>
                <p className="font-semibold">Refund amount: Rs. {refund.amount}</p>
                <p>Refund status: {refund.amount ? "PENDING_OWNER_REFUND" : "NO_REFUND_NEEDED"}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
