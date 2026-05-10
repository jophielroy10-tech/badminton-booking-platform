"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackButton from "@/components/ui/BackButton";
import { CourtCardSkeleton } from "@/components/ui/Skeleton";
import { getOwnerSlotCourts, type OwnerSlotCourt } from "@/lib/api";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import { getCourtPrimaryImage } from "@/lib/image";

export default function OwnerSlotsPage() {
  const [courts, setCourts] = useState<OwnerSlotCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getOwnerSlotCourts()
      .then((response) => setCourts(response.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load slots"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page-shell">
      <BackButton fallback="/owner/dashboard" />
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Slot Manager</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Create slots, block days, and manage court availability.</p>
        </div>
      </div>

      {error && <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">{error}</p>}
      {loading && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CourtCardSkeleton />
          <CourtCardSkeleton />
          <CourtCardSkeleton />
        </div>
      )}

      {!loading && !error && courts.length === 0 && (
        <section className="mt-6 surface-card">
          <p className="text-slate-600 dark:text-slate-300">No courts found. Add a court before creating slots.</p>
          <Link href="/owner/courts/new" className="btn-primary mt-4">Add Court</Link>
        </section>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courts.map((court) => (
          <article key={court.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="relative aspect-video bg-slate-100 dark:bg-slate-800">
              <ImageWithFallback src={getCourtPrimaryImage(court)} alt={court.name} />
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-950 dark:text-white">{court.name}</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{court.area ? `${court.area}, ` : ""}{court.city}</p>
                </div>
                <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">{court.status}</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Metric label="Slots today" value={court.slotSummaryToday.total} />
                <Metric label="Available" value={court.slotSummaryToday.available} tone="green" />
                <Metric label="Booked" value={court.slotSummaryToday.booked} tone="blue" />
                <Metric label="Blocked" value={court.slotSummaryToday.blocked} tone="red" />
              </div>

              <Link href={`/owner/slots/${court.id}`} className="btn-primary mt-5 w-full">Manage Slots</Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

function Metric({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "green" | "blue" | "red" }) {
  const toneClass = {
    slate: "text-slate-950 dark:text-white",
    green: "text-emerald-700 dark:text-emerald-300",
    blue: "text-blue-700 dark:text-blue-300",
    red: "text-red-700 dark:text-red-300"
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
