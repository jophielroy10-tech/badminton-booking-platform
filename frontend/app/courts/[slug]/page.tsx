"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createUpiBookingHold, getCourtById, getToken, trackActivity, type Court, type Slot } from "@/lib/api";
import BackButton from "@/components/ui/BackButton";
import SlotCalendar from "@/components/SlotCalendar";
import { Skeleton } from "@/components/ui/Skeleton";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import { getCourtPrimaryImage, getImageUrl } from "@/lib/image";

export default function CourtDetailsPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [court, setCourt] = useState<Court | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getCourtById(params.slug)
      .then((response) => {
        setCourt(response.data ?? null);
        if (getToken() && response.data?.id) {
          trackActivity({
            action: "USER_VIEWED_COURT_DETAILS",
            entity: "court",
            entityId: response.data.id,
            metadata: { courtName: response.data.name }
          }).catch(() => {});
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Court not found"));
  }, [params.slug]);

  const selectedSlot = useMemo(() => court?.slots?.find((slot) => slot.id === selectedSlotId), [court?.slots, selectedSlotId]);

  async function payNow() {
    if (!selectedSlot) return;
    if (!getToken()) {
      router.push("/login");
      return;
    }

    setCreatingOrder(true);
    setError("");
    try {
      if (court) {
        trackActivity({
          action: "USER_STARTED_BOOKING",
          entity: "booking",
          entityId: selectedSlot.id,
          metadata: { courtId: court.id, courtName: court.name }
        }).catch(() => {});
      }
      const response = await createUpiBookingHold({ slotId: selectedSlot.id });
      if (!response.data) throw new Error("Booking hold response missing");
      router.push(`/payment/${response.data.bookingId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start payment";
      setError(message);
      toast.error(message);
    } finally {
      setCreatingOrder(false);
    }
  }

  if (error && !court) return <main className="page-shell"><BackButton fallback="/courts" /><p className="rounded-md bg-red-50 p-4 text-red-700">{error}</p></main>;

  if (!court) {
    return (
      <main className="page-shell">
        <BackButton fallback="/courts" />
        <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <Skeleton className="h-72 w-full sm:h-96" />
            <Skeleton className="mt-6 h-8 w-2/3" />
            <Skeleton className="mt-3 h-4 w-full" />
          </div>
          <div className="surface-card">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="mt-4 h-12 w-full" />
            <Skeleton className="mt-5 h-32 w-full" />
          </div>
        </div>
      </main>
    );
  }

  const inactive = court.status !== "ACTIVE" || court.isApproved === false;
  const gallery = court.images?.length ? court.images : court.imageUrl ? [{ id: court.id, imageUrl: court.imageUrl, isPrimary: true, createdAt: "" }] : [];

  return (
    <main className="page-shell grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
      <div className="lg:col-span-2"><BackButton fallback="/courts" /></div>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative h-72 bg-slate-200 sm:h-96 dark:bg-slate-800">
          <ImageWithFallback src={getCourtPrimaryImage(court)} alt={court.name} sizes="100vw" />
        </div>
        <div className="p-6">
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white">{court.name}</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">{court.address}, {court.area ? `${court.area}, ` : ""}{court.city}</p>
          <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Call Court: {court.contactMobile || "Mobile number not added"}</p>
          <p className="mt-4 text-slate-700 dark:text-slate-300">{court.description}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {court.mapUrl && <a className="btn-secondary" href={court.mapUrl} target="_blank" rel="noreferrer">Open Map</a>}
          </div>
          {gallery.length > 1 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {gallery.slice(1).map((image) => (
                <div key={image.id} className="relative aspect-video overflow-hidden rounded-lg bg-slate-100">
                  <ImageWithFallback src={getImageUrl(image.imageUrl)} alt={court.name} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className="h-fit surface-card">
        <p className="text-sm text-slate-600 dark:text-slate-300">Starting at</p>
        <p className="mt-1 text-3xl font-bold text-slate-950 dark:text-white">Rs. {court.pricePerHour}/hour</p>
        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {inactive ? (
          <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">This court is temporarily unavailable</p>
        ) : (
          <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">Approved active court available for booking.</p>
        )}
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm text-slate-600 dark:text-slate-300">Selected slot</p>
          <p className="mt-2 font-semibold text-slate-950 dark:text-white">{selectedSlot ? formatSlot(selectedSlot) : "No slot selected"}</p>
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="font-semibold text-slate-950 dark:text-white">Cancellation policy</p>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            Cancellation charge: {Number(court.cancellationChargePercent ?? 10)}%
          </p>
        </div>
        <button className="btn-primary mt-5 w-full" disabled={inactive || !selectedSlot || creatingOrder} onClick={payNow}>
          {creatingOrder ? "Creating payment hold..." : "Pay via Owner UPI"}
        </button>
      </aside>

      {!inactive && (
        <section className="lg:col-span-2 surface-card">
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Weekly slots</h2>
          <div className="mt-5">
            <SlotCalendar slots={court.slots ?? []} selectedSlotId={selectedSlotId} onSelectSlot={(slot) => setSelectedSlotId(slot.id)} />
          </div>
        </section>
      )}
    </main>
  );
}

function formatSlot(slot: Slot) {
  const start = new Date(slot.startTime);
  const end = new Date(slot.endTime);
  return `${start.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}, ${start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}
