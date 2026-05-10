"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getOwnerCourts, type Court } from "@/lib/api";
import BackButton from "@/components/ui/BackButton";
import { Skeleton } from "@/components/ui/Skeleton";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import { getCourtPrimaryImage, getImageUrl } from "@/lib/image";

export default function OwnerCourtDetailsPage() {
  const params = useParams<{ id: string }>();
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const court = useMemo(() => courts.find((item) => item.id === params.id) ?? null, [courts, params.id]);

  useEffect(() => {
    getOwnerCourts()
      .then((response) => setCourts(response.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load court"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page-shell">
      <BackButton fallback="/owner/courts" />
      {loading && (
        <div className="surface-card">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="mt-5 h-8 w-1/2" />
          <Skeleton className="mt-3 h-4 w-2/3" />
        </div>
      )}
      {error && <p className="rounded-md bg-red-50 p-4 text-red-700">{error}</p>}
      {!loading && !error && !court && <p className="surface-card text-slate-600 dark:text-slate-300">Court not found</p>}
      {court && (
        <section className="surface-card">
          <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-100">
            <ImageWithFallback src={getCourtPrimaryImage(court)} alt={court.name} />
          </div>
          <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h1 className="text-3xl font-bold text-slate-950 dark:text-white">{court.name}</h1>
              <p className="mt-2 text-slate-600 dark:text-slate-300">{court.address}, {court.area}, {court.city}</p>
              <p className="mt-2 text-sm font-semibold uppercase text-slate-500">{court.status}</p>
              {court.mapUrl && <a className="btn-secondary mt-3 inline-flex" href={court.mapUrl} target="_blank" rel="noreferrer">Open Map</a>}
            </div>
            <Link href={`/owner/courts/${court.id}/edit`} className="btn-primary">Edit Court</Link>
          </div>
          {court.images && court.images.length > 1 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              {court.images.slice(1).map((image) => (
                <div key={image.id} className="relative aspect-video overflow-hidden rounded-lg bg-slate-100">
                  <ImageWithFallback src={getImageUrl(image.imageUrl)} alt={court.name} />
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Payment Receiving Details</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">UPI ID: {court.upiId || "Missing"}</p>
                {court.upiUpdatedAt && <p className="mt-1 text-xs text-slate-500">Last updated {new Date(court.upiUpdatedAt).toLocaleString()}</p>}
                {court.upiQrImageUrl ? <p className="mt-1 text-xs text-emerald-600">QR uploaded</p> : <p className="mt-1 text-xs text-amber-600">No QR uploaded. Users will see a generated QR.</p>}
              </div>
              <span className={court.upiId ? "rounded bg-emerald-50 px-3 py-1 text-xs font-bold uppercase text-emerald-700" : "rounded bg-red-50 px-3 py-1 text-xs font-bold uppercase text-red-700"}>
                {court.upiId ? "UPI Ready" : "UPI Missing"}
              </span>
            </div>
            {court.upiQrImageUrl && (
              <div className="relative mt-4 h-56 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800">
                <ImageWithFallback src={getImageUrl(court.upiQrImageUrl)} alt={`${court.name} UPI QR`} placeholder="No QR uploaded" contain />
              </div>
            )}
            <Link href={`/owner/courts/${court.id}/edit`} className="btn-secondary mt-4 inline-flex">Edit payment details</Link>
          </div>
        </section>
      )}
    </main>
  );
}
