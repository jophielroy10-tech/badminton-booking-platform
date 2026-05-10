"use client";

import { useEffect, useState } from "react";
import { getAdminPayments, type Payment } from "@/lib/api";
import BackButton from "@/components/ui/BackButton";
import { BookingCardSkeleton } from "@/components/ui/Skeleton";

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getAdminPayments()
      .then((response) => setPayments(response.data ?? []))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, []);
  return (
    <main className="page-shell">
      <BackButton fallback="/admin/dashboard" />
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Admin Payments</h1>
      {loading && <div className="mt-6"><BookingCardSkeleton /></div>}
      {!loading && (
        <section className="mt-6 surface-card overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Court</th><th>User</th><th>Provider</th><th>Amount</th><th>Status</th><th>Owner/Court UPI</th><th>UTR</th></tr></thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="py-3">{payment.booking?.court?.name ?? "-"}</td>
                  <td className="break-all">{payment.user?.email ?? "-"}</td>
                  <td>{payment.provider}</td>
                  <td>Rs. {payment.finalAmount}</td>
                  <td>{payment.status}</td>
                  <td className="break-all">{payment.upiId || payment.booking?.court?.upiId || "-"}</td>
                  <td className="break-all">{payment.utrNumber || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
