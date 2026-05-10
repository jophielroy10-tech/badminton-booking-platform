"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getOwnerCourts, type Court } from "@/lib/api";
import BackButton from "@/components/ui/BackButton";
import { CourtCardSkeleton } from "@/components/ui/Skeleton";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import { getCourtPrimaryImage } from "@/lib/image";

export default function OwnerCourtsPage() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getOwnerCourts()
      .then((response) => setCourts(response.data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page-shell">
      <BackButton fallback="/owner/dashboard" />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Owner Courts</h1>
        <Link href="/owner/courts/new" className="btn-primary w-full sm:w-auto">New Court</Link>
      </div>
      {error && <p className="mt-4 rounded-md bg-red-50 p-4 text-red-700">{error}</p>}
      {loading && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <CourtCardSkeleton />
          <CourtCardSkeleton />
          <CourtCardSkeleton />
          <CourtCardSkeleton />
        </div>
      )}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {!loading && courts.map((court) => (
          <article key={court.id} className="surface-card">
            <div className="relative mb-4 aspect-video overflow-hidden rounded-lg bg-slate-100">
              <ImageWithFallback src={getCourtPrimaryImage(court)} alt={court.name} />
            </div>
            <h2 className="font-semibold text-slate-950 dark:text-white">{court.name}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{court.area}, {court.city}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Mobile: {court.contactMobile || "Mobile number not added"}</p>
            {court.status === "PENDING_APPROVAL" && <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">Waiting for Admin Approval</p>}
            {court.status === "REJECTED" && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Rejected by Admin: {court.rejectionReason}</p>}
            {court.status === "ACTIVE" && <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Live</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {court.upiId && court.upiQrImageUrl ? (
                <span className="rounded bg-emerald-50 px-3 py-1 text-xs font-bold uppercase text-emerald-700">UPI Ready</span>
              ) : (
                <span className="rounded bg-red-50 px-3 py-1 text-xs font-bold uppercase text-red-700">UPI Missing</span>
              )}
            </div>
            {(!court.upiId || !court.upiQrImageUrl) && (
              <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">Add UPI details before approval/booking</p>
            )}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-bold uppercase text-slate-500">{court.status}</span>
              <Link href={`/owner/courts/${court.id}/edit`} className="btn-secondary w-full sm:w-auto">Edit</Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
