"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { checkInUser, getOwnerBookings, getToken, trackActivity, type Booking } from "@/lib/api";
import BackButton from "@/components/ui/BackButton";

export default function OwnerBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [checkInValues, setCheckInValues] = useState<Record<string, string>>({});

  async function load() {
    const response = await getOwnerBookings();
    setBookings(response.data ?? []);
  }

  useEffect(() => {
    if (getToken()) {
      trackActivity({ action: "OWNER_VIEWED_BOOKINGS", entity: "booking" }).catch(() => {});
    }
    load().catch(() => setBookings([]));
  }, []);

  async function checkIn(bookingId: string) {
    const value = checkInValues[bookingId]?.trim();
    if (!value) {
      toast.error("Enter OTP or QR token");
      return;
    }
    await checkInUser({ bookingId, otp: /^\d{6}$/.test(value) ? value : undefined, qrToken: /^\d{6}$/.test(value) ? undefined : value });
    toast.success("Checked in");
    await load();
  }

  return (
    <main className="page-shell">
      <BackButton fallback="/owner/dashboard" />
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Owner Bookings</h1>
      {bookings.some((booking) => booking.status === "CANCELLED") && (
        <section className="mt-6 surface-card">
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Cancelled Bookings / Refunds</h2>
          <div className="mt-4 grid gap-3">
            {bookings.filter((booking) => booking.status === "CANCELLED").map((booking) => {
              const refund = booking.refund ?? booking.payment?.refund ?? null;
              return (
                <div key={booking.id} className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                  <p className="font-semibold">{booking.user?.name ?? "Customer"} · {booking.court.name}</p>
                  <p className="mt-1">{new Date(booking.slot.startTime).toLocaleString("en-IN")} - {new Date(booking.slot.endTime).toLocaleTimeString("en-IN")}</p>
                  <p>Paid amount: Rs. {booking.payment?.finalAmount ?? 0}</p>
                  <p>Cancellation charge retained: Rs. {refund?.cancellationCharge ?? 0}</p>
                  <p className="font-semibold">Refund Rs. {refund?.amount ?? 0} to user. Refund status: {refund?.amount ? "PENDING_OWNER_REFUND" : "NO_REFUND_NEEDED"}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <div className="mt-6 space-y-4">
        {bookings.map((booking) => (
          <article key={booking.id} className="surface-card">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <h2 className="font-semibold text-slate-950 dark:text-white">{booking.court.name}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {booking.user?.name ?? "Customer"} · {booking.status} · Payment {booking.payment?.status}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {new Date(booking.slot.startTime).toLocaleString("en-IN")} - {new Date(booking.slot.endTime).toLocaleTimeString("en-IN")}
                </p>
              </div>
              {booking.status === "CONFIRMED" && !booking.checkedIn && (
                <div className="flex w-full gap-2 lg:w-auto">
                  <input
                    className="field"
                    placeholder="OTP or QR token"
                    value={checkInValues[booking.id] ?? ""}
                    onChange={(event) => setCheckInValues({ ...checkInValues, [booking.id]: event.target.value })}
                  />
                  <button className="btn-primary shrink-0" onClick={() => checkIn(booking.id)}>Check In</button>
                </div>
              )}
              {booking.checkedIn && <span className="rounded bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">Checked in</span>}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
