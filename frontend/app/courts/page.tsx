"use client";

import { useEffect, useMemo, useState } from "react";
import CourtCard from "@/components/CourtCard";
import { Court, getCourts, getToken, trackActivity } from "@/lib/api";
import { CourtCardSkeleton } from "@/components/ui/Skeleton";

export default function CourtsPage() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (getToken()) {
      trackActivity({ action: "USER_VIEWED_COURTS", entity: "court" }).catch(() => {});
    }
    getCourts()
      .then((data) => {
        const nextCourts = Array.isArray(data) ? data : data?.data || (data as any)?.courts || [];
        if (process.env.NODE_ENV === "development") {
          console.log("COURTS_PAGE_RAW_DATA", nextCourts);
          console.log("COURTS_PAGE_FIRST_COURT", nextCourts[0]);
          console.log(
            "COURTS_PAGE_FIRST_IMAGE_URL",
            nextCourts[0]?.images?.find((img: any) => img?.isPrimary)?.imageUrl ||
              nextCourts[0]?.images?.[0]?.imageUrl ||
              nextCourts[0]?.imageUrl
          );
        }
        setCourts(nextCourts);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load courts. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => courts.filter((court) => `${court.name} ${court.city} ${court.area ?? ""}`.toLowerCase().includes(query.toLowerCase())), [courts, query]);

  return (
    <main className="page-shell">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Courts</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-300">Search and book available badminton courts.</p>
        </div>
        <input className="field max-w-sm" placeholder="Search by name or city" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {loading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <CourtCardSkeleton />
          <CourtCardSkeleton />
          <CourtCardSkeleton />
          <CourtCardSkeleton />
          <CourtCardSkeleton />
          <CourtCardSkeleton />
        </div>
      )}
      {error && <p className="rounded-md bg-red-50 p-4 text-red-700">Could not load courts: {error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          No courts found.
        </div>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((court) => <CourtCard key={court.id} court={court} />)}
        </div>
      )}
    </main>
  );
}
