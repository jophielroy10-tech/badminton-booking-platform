"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import RazorpayCheckout from "@/components/RazorpayCheckout";
import BackButton from "@/components/ui/BackButton";
import SlotCalendar from "@/components/SlotCalendar";
import { Skeleton } from "@/components/ui/Skeleton";
import { confirmBooking, createBookingHold, getCourtById, getToken, trackActivity, type Court, type Slot } from "@/lib/api";

type OrderData = {
  bookingId: string;
  paymentId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  key: string;
};

export default function BookingPage() {
  return (
    <Suspense fallback={<main className="page-shell"><Skeleton className="h-32 w-full" /></main>}>
      <BookingContent />
    </Suspense>
  );
}

function BookingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courtId = searchParams.get("courtId");
  const slotIdFromUrl = searchParams.get("slotId");
  const [court, setCourt] = useState<Court | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState(slotIdFromUrl ?? "");
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!courtId) return;
    getCourtById(courtId)
      .then((response) => setCourt(response.data ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load court"));
  }, [courtId]);

  const selectedSlot = useMemo(
    () => court?.slots?.find((slot) => slot.id === selectedSlotId),
    [court?.slots, selectedSlotId]
  );

  async function payNow() {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    if (!selectedSlotId) {
      setError("Please select a slot");
      return;
    }

    setLoading(true);
    setError("");
    try {
      if (selectedSlot) {
        trackActivity({
          action: "USER_STARTED_BOOKING",
          entity: "booking",
          entityId: selectedSlot.id,
          metadata: { courtId: court?.id, courtName: court?.name }
        }).catch(() => {});
      }
      const response = await createBookingHold({ slotId: selectedSlotId });
      if (!response.data) throw new Error("Booking hold response missing");
      setOrderData(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start payment";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePaymentSuccess(paymentResponse: {
    bookingId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    const response = await confirmBooking(paymentResponse);
    if (response.data) {
      localStorage.setItem("lastConfirmedBooking", JSON.stringify(response.data));
    }
    toast.success("Booking confirmed");
    router.push(`/payment/success?bookingId=${paymentResponse.bookingId}`);
  }

  if (!courtId) {
    return (
      <main className="page-shell">
        <div className="surface-card">
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Booking</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Choose a court before booking.</p>
          <Link href="/courts" className="btn-primary mt-4">Browse Courts</Link>
        </div>
      </main>
    );
  }

  const inactive = court && court.status !== "ACTIVE";

  return (
    <main className="page-shell">
      <BackButton fallback="/courts" />
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Complete Booking</h1>
      {error && <p className="mt-4 rounded-md bg-red-50 p-4 text-red-700">{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="surface-card">
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{court?.name ?? "Loading court..."}</h2>
          {inactive && <p className="mt-4 rounded-md bg-red-50 p-3 text-red-700">This court is temporarily unavailable</p>}
          <div className="mt-5">
            <SlotCalendar
              slots={court?.slots ?? []}
              selectedSlotId={selectedSlotId}
              disabled={Boolean(inactive)}
              onSelectSlot={(slot) => setSelectedSlotId(slot.id)}
            />
          </div>
          {court && (court.slots ?? []).length === 0 && (
            <p className="mt-4 rounded-md bg-slate-50 p-3 text-slate-600 dark:bg-slate-800 dark:text-slate-300">No available slots right now.</p>
          )}
        </section>

        <aside className="h-fit surface-card">
          <p className="text-sm text-slate-600 dark:text-slate-300">Selected slot</p>
          <p className="mt-2 font-semibold text-slate-950 dark:text-white">{selectedSlot ? formatSlot(selectedSlot) : "No slot selected"}</p>
          <button className="btn-primary mt-5 w-full" disabled={loading || inactive || !selectedSlot} onClick={payNow}>
            {loading ? "Creating order..." : "Pay Now"}
          </button>
        </aside>
      </div>

      {orderData && (
        <RazorpayCheckout
          orderData={orderData}
          onSuccess={handlePaymentSuccess}
          onFailure={() => setOrderData(null)}
        />
      )}
    </main>
  );
}

function formatSlot(slot: Slot) {
  const start = new Date(slot.startTime);
  const end = new Date(slot.endTime);
  return `${start.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}, ${start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}
