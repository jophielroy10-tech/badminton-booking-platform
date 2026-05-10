"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, CalendarDays, Clock, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  blockOwnerSlots,
  deleteOwnerSlot,
  generateOwnerSlots,
  generateOwnerSlotsBulk,
  generateOwnerSlotsFromSchedule,
  getOwnerCourtSlots,
  makeOwnerCourtAvailableDay,
  makeOwnerCourtUnavailableDay,
  updateOwnerSlot,
  type GenerateSlotsPayload,
  type OwnerCourtSlots,
  type Slot
} from "@/lib/api";

const durations = [
  { label: "30 mins", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "1.5 hours", value: 90 },
  { label: "2 hours", value: 120 }
] as const;

const presets = [
  { label: "Morning", startTime: "06:00", endTime: "12:00" },
  { label: "Afternoon", startTime: "12:00", endTime: "17:00" },
  { label: "Evening", startTime: "17:00", endTime: "22:00" },
  { label: "Full Day", startTime: "06:00", endTime: "22:00" }
];

const weekdays = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 }
];

function todayOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function OwnerCourtSlotsPage() {
  const params = useParams<{ courtId: string }>();
  const [selectedDate, setSelectedDate] = useState(todayOffset(0));
  const [details, setDetails] = useState<OwnerCourtSlots | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [blockReason, setBlockReason] = useState("Maintenance");
  const [editSlot, setEditSlot] = useState<Slot | null>(null);
  const [deleteSlot, setDeleteSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState<GenerateSlotsPayload>({ date: selectedDate, startTime: "06:00", endTime: "22:00", durationMinutes: 60, overwriteExisting: false });
  const [useDefaultPrice, setUseDefaultPrice] = useState(true);
  const [repeatDays, setRepeatDays] = useState(0);
  const [repeatWeekdays, setRepeatWeekdays] = useState([0, 1, 2, 3, 4, 5, 6]);

  async function load(date = selectedDate) {
    setError("");
    const response = await getOwnerCourtSlots(params.courtId, date);
    setDetails(response.data ?? null);
  }

  useEffect(() => {
    setLoading(true);
    load(selectedDate)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load slots"))
      .finally(() => setLoading(false));
  }, [params.courtId, selectedDate]);

  useEffect(() => {
    setForm((current) => ({ ...current, date: selectedDate }));
    setSelectedIds([]);
  }, [selectedDate]);

  const validationError = useMemo(() => {
    if (!form.startTime) return "Start time required";
    if (!form.endTime) return "End time required";
    if (form.startTime >= form.endTime) return "End must be after start";
    if (!form.durationMinutes) return "Duration required";
    if (!useDefaultPrice && (!form.price || form.price <= 0)) return "Price required unless using court price";
    return "";
  }, [form, useDefaultPrice]);

  async function runAction(action: () => Promise<void>) {
    setSaving(true);
    try {
      await action();
      await load(selectedDate);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitGenerate(forceOneHour = false) {
    if (validationError) {
      toast.error(validationError);
      return;
    }
    const payload = {
      ...form,
      durationMinutes: forceOneHour ? 60 : form.durationMinutes,
      price: useDefaultPrice ? undefined : form.price
    } as GenerateSlotsPayload;

    await runAction(async () => {
      const response = repeatDays
        ? await generateOwnerSlotsBulk(params.courtId, { ...payload, startDate: form.date, repeatDays, weekdays: repeatWeekdays })
        : await generateOwnerSlots(params.courtId, payload);
      toast.success(`Created ${response.data?.createdCount ?? 0}, skipped ${response.data?.skippedCount ?? 0}`);
    });
  }

  const slots = details?.slots ?? [];

  return (
    <main className="page-shell">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <Link href="/owner/slots" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><ArrowLeft className="h-4 w-4" /> Slots</Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">{details?.court.name ?? "Court Slots"}</h1>
          {details?.court && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{details.court.status} · Rs. {details.court.pricePerHour}/hour</p>}
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <input className="field col-span-2 sm:w-auto sm:min-w-[170px]" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          <button className="btn-secondary w-full sm:w-auto" onClick={() => setSelectedDate(todayOffset(0))}>Today</button>
          <button className="btn-secondary w-full sm:w-auto" onClick={() => setSelectedDate(todayOffset(1))}>Tomorrow</button>
          <button className="btn-secondary col-span-2 w-full sm:w-auto" onClick={() => setSelectedDate(todayOffset(7))}>Next 7 days</button>
        </div>
      </div>

      {loading && <div className="mt-6 grid gap-4"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>}
      {error && <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">{error}</p>}

      {!loading && !error && details && (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Total" value={details.summary.total} />
            <Stat label="Available" value={details.summary.available} tone="green" />
            <Stat label="Booked" value={details.summary.booked} tone="blue" />
            <Stat label="Blocked" value={details.summary.blocked} tone="red" />
            <Stat label="Hold" value={details.summary.hold} tone="yellow" />
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_.75fr]">
            <div className="surface-card">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Generate Slots</h2>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {presets.map((preset) => (
                  <button key={preset.label} className="btn-secondary w-full sm:w-auto" onClick={() => setForm((current) => ({ ...current, startTime: preset.startTime, endTime: preset.endTime, durationMinutes: 60 }))}>{preset.label}</button>
                ))}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Date"><input className="field" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
                <Field label="Start time"><input className="field" type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></Field>
                <Field label="End time"><input className="field" type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></Field>
                <Field label="Duration"><select className="field" value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) as GenerateSlotsPayload["durationMinutes"] })}>{durations.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
                <Field label="Price per slot"><input className="field" type="number" min="1" disabled={useDefaultPrice} value={form.price ?? ""} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} placeholder={`Default Rs. ${details.court.pricePerHour}`} /></Field>
                <div className="grid content-end gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><input type="checkbox" checked={useDefaultPrice} onChange={(event) => setUseDefaultPrice(event.target.checked)} /> Use court default price</label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><input type="checkbox" checked={Boolean(form.overwriteExisting)} onChange={(event) => setForm({ ...form, overwriteExisting: event.target.checked })} /> Overwrite available/blocked</label>
                </div>
              </div>
              <div className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">Repeat slots</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  {[0, 7, 14, 30].map((days) => <button key={days} className={`${repeatDays === days ? "btn-primary" : "btn-secondary"} w-full sm:w-auto`} onClick={() => setRepeatDays(days)}>{days === 0 ? "No repeat" : `Next ${days} days`}</button>)}
                </div>
                {repeatDays > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {weekdays.map((day) => (
                      <button key={day.value} className={repeatWeekdays.includes(day.value) ? "btn-primary px-3" : "btn-secondary px-3"} onClick={() => setRepeatWeekdays((current) => current.includes(day.value) ? current.filter((value) => value !== day.value) : [...current, day.value])}>{day.label}</button>
                    ))}
                  </div>
                )}
              </div>
              {validationError && <p className="mt-3 text-sm text-red-600">{validationError}</p>}
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button className="btn-primary w-full sm:w-auto" disabled={saving || Boolean(validationError)} onClick={() => submitGenerate(false)}>{saving ? "Working..." : "Generate Slots"}</button>
                <button className="btn-secondary w-full sm:w-auto" disabled={saving || Boolean(validationError)} onClick={() => submitGenerate(true)}>Create 1-hour slots</button>
                <button className="btn-secondary w-full sm:w-auto" disabled={saving} onClick={() => runAction(async () => { const response = await generateOwnerSlotsFromSchedule(params.courtId); toast.success(`Created ${response.data?.createdCount ?? 0}, skipped ${response.data?.skippedCount ?? 0}`); })}>Generate from saved schedule</button>
              </div>
            </div>

            <div className="surface-card">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Availability</h2>
              </div>
              <Field label="Reason"><input className="field" value={blockReason} onChange={(event) => setBlockReason(event.target.value)} placeholder="Maintenance" /></Field>
              <div className="mt-4 grid gap-2">
                <button className="btn-secondary justify-start" disabled={saving} onClick={() => {
                  if (confirm("This will block all available slots for today. Existing confirmed bookings will not be cancelled.")) {
                    runAction(async () => { const response = await makeOwnerCourtUnavailableDay(params.courtId, { date: todayOffset(0), reason: blockReason }); toast.success(`Blocked ${response.data?.blockedCount ?? 0}`); });
                  }
                }}>Make Today Unavailable</button>
                <button className="btn-secondary justify-start" disabled={saving || !blockReason.trim()} onClick={() => runAction(async () => { const response = await makeOwnerCourtUnavailableDay(params.courtId, { date: selectedDate, reason: blockReason }); toast.success(`Blocked ${response.data?.blockedCount ?? 0}`); })}>Make Selected Day Unavailable</button>
                <button className="btn-secondary justify-start" disabled={saving} onClick={() => runAction(async () => { const response = await makeOwnerCourtAvailableDay(params.courtId, { date: selectedDate }); toast.success(`Available ${response.data?.updatedCount ?? 0}`); })}>Make Selected Day Available</button>
                <button className="btn-primary justify-start" disabled={saving || selectedIds.length === 0 || !blockReason.trim()} onClick={() => runAction(async () => { const response = await blockOwnerSlots(params.courtId, { slotIds: selectedIds, reason: blockReason }); toast.success(`Blocked ${response.data?.blockedCount ?? 0}`); setSelectedIds([]); })}>Block Selected Slots</button>
              </div>
            </div>
          </section>

          <section className="mt-6 surface-card">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Existing Slots</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">{new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" })}</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {slots.map((slot) => (
                <article key={slot.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                      <input type="checkbox" checked={selectedIds.includes(slot.id)} disabled={slot.status !== "AVAILABLE"} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, slot.id] : current.filter((id) => id !== slot.id))} />
                      {time(slot.startTime)} - {time(slot.endTime)}
                    </label>
                    <Badge status={slot.status} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">Rs. {slot.price}</p>
                  {slot.reason && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{slot.reason}</p>}
                  <div className="mt-4 flex gap-2">
                    <button className="btn-secondary flex-1" disabled={slot.status === "BOOKED" || slot.status === "HOLD"} onClick={() => setEditSlot(slot)}>Edit</button>
                    <button className="btn-secondary px-3 text-red-600" disabled={slot.status === "BOOKED" || slot.status === "HOLD"} onClick={() => setDeleteSlot(slot)}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </article>
              ))}
            </div>
            {slots.length === 0 && <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">No slots created for this day</p>}
          </section>
        </>
      )}

      <EditSlotModal slot={editSlot} onClose={() => setEditSlot(null)} onSave={(payload) => runAction(async () => { if (!editSlot) return; await updateOwnerSlot(editSlot.id, payload); toast.success("Slot updated"); setEditSlot(null); })} />
      <Modal open={Boolean(deleteSlot)} title="Delete this slot?" onClose={() => setDeleteSlot(null)}>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">This removes the available or blocked slot from the court calendar.</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="btn-secondary" onClick={() => setDeleteSlot(null)}>Cancel</button>
          <button className="btn-primary bg-red-600 hover:bg-red-700" onClick={() => runAction(async () => { if (!deleteSlot) return; await deleteOwnerSlot(deleteSlot.id); toast.success("Slot deleted"); setDeleteSlot(null); })}>Delete</button>
        </div>
      </Modal>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">{label}{children}</label>;
}

function Stat({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "green" | "blue" | "red" | "yellow" }) {
  const colors = { slate: "text-slate-950 dark:text-white", green: "text-emerald-700 dark:text-emerald-300", blue: "text-blue-700 dark:text-blue-300", red: "text-red-700 dark:text-red-300", yellow: "text-amber-700 dark:text-amber-300" };
  return <div className="surface-card"><p className="text-sm text-slate-600 dark:text-slate-300">{label}</p><p className={`mt-2 text-2xl font-bold ${colors[tone]}`}>{value}</p></div>;
}

function Badge({ status }: { status: Slot["status"] }) {
  const classes = {
    AVAILABLE: "bg-emerald-100 text-emerald-800",
    HOLD: "bg-amber-100 text-amber-800",
    BOOKED: "bg-blue-100 text-blue-800",
    BLOCKED: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
  };
  return <span className={`rounded px-2 py-1 text-xs font-bold ${classes[status]}`}>{status}</span>;
}

function time(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function EditSlotModal({ slot, onClose, onSave }: { slot: Slot | null; onClose: () => void; onSave: (payload: { price: number; status: "AVAILABLE" | "BLOCKED"; reason?: string | null }) => void }) {
  const [price, setPrice] = useState(0);
  const [status, setStatus] = useState<"AVAILABLE" | "BLOCKED">("AVAILABLE");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!slot) return;
    setPrice(Number(slot.price));
    setStatus(slot.status === "BLOCKED" ? "BLOCKED" : "AVAILABLE");
    setReason(slot.reason || "");
  }, [slot]);

  return (
    <Modal open={Boolean(slot)} title="Edit slot" onClose={onClose}>
      <div className="mt-4 grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">Price<input className="field" type="number" min="1" value={price} onChange={(event) => setPrice(Number(event.target.value))} /></label>
        <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">Status<select className="field" value={status} onChange={(event) => setStatus(event.target.value as "AVAILABLE" | "BLOCKED")}><option value="AVAILABLE">AVAILABLE</option><option value="BLOCKED">BLOCKED</option></select></label>
        <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">Reason<input className="field" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Maintenance" /></label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={price <= 0 || (status === "BLOCKED" && !reason.trim())} onClick={() => onSave({ price, status, reason: status === "BLOCKED" ? reason : null })}>Save</button>
        </div>
      </div>
    </Modal>
  );
}
