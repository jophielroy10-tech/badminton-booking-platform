"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import BackButton from "@/components/ui/BackButton";
import Modal from "@/components/ui/Modal";
import { BookingCardSkeleton } from "@/components/ui/Skeleton";
import {
  generateAdminDailySettlement,
  generateAdminMonthlySettlement,
  getAdminOwnerSettlementPayments,
  getAdminSettlementSummary,
  getAdminSettlements,
  markAdminSettlementPaid,
  rejectAdminOwnerSettlementPayment,
  verifyAdminOwnerSettlementPayment,
  type OwnerSettlement,
  type OwnerSettlementPaymentSubmission,
  type SettlementSummary
} from "@/lib/api";

export default function AdminSettlementsPage() {
  const now = new Date();
  const [date, setDate] = useState(now.toISOString().slice(0, 10));
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [ownerId, setOwnerId] = useState("");
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [items, setItems] = useState<OwnerSettlement[]>([]);
  const [ownerPayments, setOwnerPayments] = useState<OwnerSettlementPaymentSubmission[]>([]);
  const [paymentCycle, setPaymentCycle] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [paidTarget, setPaidTarget] = useState<OwnerSettlement | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<OwnerSettlementPaymentSubmission | null>(null);
  const [rejectTarget, setRejectTarget] = useState<OwnerSettlementPaymentSubmission | null>(null);

  async function load() {
    setLoading(true);
    const [summaryResponse, listResponse, paymentResponse] = await Promise.all([
      getAdminSettlementSummary(),
      getAdminSettlements({ status, ownerId }),
      getAdminOwnerSettlementPayments({ cycle: paymentCycle || undefined, status: paymentStatus || undefined })
    ]);
    setSummary(summaryResponse.data ?? null);
    setItems(listResponse.data ?? []);
    setOwnerPayments(paymentResponse.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => {
      toast.error("Unable to load settlements");
      setLoading(false);
    });
  }, [status, paymentCycle, paymentStatus]);

  async function generateDaily() {
    await generateAdminDailySettlement({ date, ownerId: ownerId || undefined });
    toast.success("Daily settlements generated");
    await load();
  }

  async function generateMonthly() {
    await generateAdminMonthlySettlement({ month, year, ownerId: ownerId || undefined });
    toast.success("Monthly settlements generated");
    await load();
  }

  return (
    <main className="page-shell">
      <BackButton fallback="/admin/dashboard" />
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Owner Settlements</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-300">Generate owner payouts and mark them paid after transfer.</p>

      {summary && (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total pending settlement" value={`Rs. ${summary.totalPendingSettlement}`} />
          <Stat label="Total paid settlement" value={`Rs. ${summary.totalPaidSettlement}`} />
          <Stat label="Today pending" value={`Rs. ${summary.todayPending}`} />
          <Stat label="This month pending" value={`Rs. ${summary.thisMonthPending}`} />
        </section>
      )}

      <section className="mt-6 surface-card">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Generate Settlement</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input className="field" placeholder="Optional owner ID" value={ownerId} onChange={(event) => setOwnerId(event.target.value)} />
          <input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <button className="btn-secondary" onClick={generateDaily}>Generate Daily Night Settlement</button>
          <div className="grid grid-cols-2 gap-2">
            <input className="field" type="number" min={1} max={12} value={month} onChange={(event) => setMonth(Number(event.target.value))} />
            <input className="field" type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} />
          </div>
          <button className="btn-primary md:col-span-4" onClick={generateMonthly}>Generate Monthly Settlement</button>
        </div>
      </section>

      <div className="mt-5 max-w-xs">
        <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {["PENDING", "PROCESSING", "PAID", "FAILED"].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      {loading && <div className="mt-6"><BookingCardSkeleton /></div>}
      {!loading && (
        <section className="mt-6 surface-card overflow-x-auto">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Owner Payments to Admin</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <select className="field" value={paymentCycle} onChange={(event) => setPaymentCycle(event.target.value)}>
                <option value="">All types</option>
                {["DAILY", "MONTHLY", "TOTAL_PENDING"].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select className="field" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
                <option value="">All payment statuses</option>
                {["SUBMITTED", "VERIFIED", "REJECTED"].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>
          <table className="mt-4 min-w-[960px] w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Owner</th><th>Type</th><th>Date / range</th><th>Amount</th><th>UTR</th><th>Submitted at</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {ownerPayments.map((item) => (
                <tr key={item.id}>
                  <td className="py-3"><p className="font-semibold">{item.owner.name}</p><p className="text-xs text-slate-500">{item.owner.email}</p></td>
                  <td>{item.type || item.cycle}</td>
                  <td>{new Date(item.fromDate).toLocaleDateString("en-IN")} - {new Date(item.toDate).toLocaleDateString("en-IN")}</td>
                  <td className="font-semibold">Rs. {item.amount}</td>
                  <td>{item.utrNumber || "-"}</td>
                  <td>{item.submittedAt ? new Date(item.submittedAt).toLocaleString("en-IN") : "-"}</td>
                  <td>{item.status}</td>
                  <td>
                    <div className="flex gap-2">
                      {item.status === "SUBMITTED" ? (
                        <>
                          <button className="text-sm font-semibold text-emerald-600" onClick={() => setVerifyTarget(item)}>Verify</button>
                          <button className="text-sm font-semibold text-red-600" onClick={() => setRejectTarget(item)}>Reject</button>
                        </>
                      ) : "-"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ownerPayments.length === 0 && <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No owner payment submissions waiting for verification.</p>}
        </section>
      )}
      {!loading && (
        <section className="mt-6 surface-card overflow-x-auto">
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Owner</th><th>Cycle</th><th>Date range</th><th>Gross</th><th>Commission</th><th>Net</th><th>Status</th><th>UTR</th><th>Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3"><p className="font-semibold">{item.owner?.name}</p><p className="text-xs text-slate-500">{item.owner?.email}</p></td>
                  <td>{item.cycle}</td>
                  <td>{new Date(item.fromDate).toLocaleDateString("en-IN")} - {new Date(item.toDate).toLocaleDateString("en-IN")}</td>
                  <td>Rs. {item.grossAmount}</td>
                  <td>Rs. {item.totalCommission}</td>
                  <td className="font-semibold">Rs. {item.netAmount}</td>
                  <td>{item.status}</td>
                  <td>{item.settlementUtr || "-"}</td>
                  <td>{item.status !== "PAID" && <button className="text-sm font-semibold text-emerald-600" onClick={() => setPaidTarget(item)}>Mark Paid</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No settlements found.</p>}
        </section>
      )}
      <MarkPaidModal settlement={paidTarget} onClose={() => setPaidTarget(null)} onSaved={load} />
      <VerifyOwnerPaymentModal payment={verifyTarget} onClose={() => setVerifyTarget(null)} onSaved={load} />
      <RejectOwnerPaymentModal payment={rejectTarget} onClose={() => setRejectTarget(null)} onSaved={load} />
    </main>
  );
}

function MarkPaidModal({ settlement, onClose, onSaved }: { settlement: OwnerSettlement | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [settlementUtr, setSettlementUtr] = useState("");
  const [note, setNote] = useState("");
  async function save() {
    if (!settlement) return;
    await markAdminSettlementPaid(settlement.id, { settlementUtr, note });
    toast.success("Settlement marked paid");
    setSettlementUtr("");
    setNote("");
    onClose();
    await onSaved();
  }
  return (
    <Modal open={Boolean(settlement)} title="Mark Settlement Paid" onClose={onClose}>
      <div className="mt-4 grid gap-4">
        <input className="field" placeholder="Settlement UTR" value={settlementUtr} onChange={(event) => setSettlementUtr(event.target.value.toUpperCase())} />
        <textarea className="field min-h-24" placeholder="Note optional" value={note} onChange={(event) => setNote(event.target.value)} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={settlementUtr.trim().length < 6} onClick={save}>Confirm</button>
        </div>
      </div>
    </Modal>
  );
}

function VerifyOwnerPaymentModal({ payment, onClose, onSaved }: { payment: OwnerSettlementPaymentSubmission | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!payment) return;
    setSaving(true);
    try {
      await verifyAdminOwnerSettlementPayment(payment.id);
      toast.success("Owner payment verified");
      onClose();
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to verify payment");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={Boolean(payment)} title="Verify owner payment" onClose={onClose}>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Verify this owner payment?</p>
      {payment && <p className="mt-2 font-semibold text-slate-950 dark:text-white">{payment.owner.name} - Rs. {payment.amount} - {payment.utrNumber}</p>}
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Verifying..." : "Verify"}</button>
      </div>
    </Modal>
  );
}

function RejectOwnerPaymentModal({ payment, onClose, onSaved }: { payment: OwnerSettlementPaymentSubmission | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!payment) return;
    setSaving(true);
    try {
      await rejectAdminOwnerSettlementPayment(payment.id, reason);
      toast.success("Owner payment rejected");
      setReason("");
      onClose();
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to reject payment");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={Boolean(payment)} title="Reject owner payment" onClose={onClose}>
      <textarea className="field mt-4 min-h-24" placeholder="Reason, for example UTR not received" value={reason} onChange={(event) => setReason(event.target.value)} />
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={saving || reason.trim().length < 3} onClick={save}>{saving ? "Rejecting..." : "Reject"}</button>
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="surface-card"><p className="text-sm text-slate-600 dark:text-slate-300">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</p></div>;
}
