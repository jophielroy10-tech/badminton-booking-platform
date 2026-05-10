"use client";

import { useEffect, useState } from "react";
import { getAdminBookings, type Booking } from "@/lib/api";
import BackButton from "@/components/ui/BackButton";

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    getAdminBookings().then((response) => setBookings(response.data ?? [])).catch(() => setBookings([]));
  }, []);

  return (
    <main className="page-shell">
      <BackButton fallback="/admin/dashboard" />
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Admin Bookings</h1>
      <div className="mt-6 space-y-3">
        {bookings.map((booking) => {
          const refund = booking.refund ?? booking.payment?.refund ?? null;
          return (
            <article key={booking.id} className="surface-card">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                <div>
                  <h2 className="font-semibold text-slate-950 dark:text-white">{booking.court.name}</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    User: {booking.user?.name ?? "User"} · Owner: {booking.court.owner?.name ?? "Owner"} · {booking.status}
                  </p>
                  {booking.slot && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {new Date(booking.slot.startTime).toLocaleString("en-IN")} - {new Date(booking.slot.endTime).toLocaleTimeString("en-IN")}
                    </p>
                  )}
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300 lg:text-right">
                  <p>Paid: Rs. {booking.payment?.finalAmount ?? 0}</p>
                  {booking.status === "CANCELLED" && (
                    <>
                      <p>Cancellation %: {refund?.cancellationChargePercent ?? booking.court.cancellationChargePercent ?? 10}%</p>
                      <p>Cancellation charge: Rs. {refund?.cancellationCharge ?? 0}</p>
                      <p>Refund amount: Rs. {refund?.amount ?? 0}</p>
                      <p>Refund status: {refund?.amount ? "PENDING_OWNER_REFUND" : "NO_REFUND_NEEDED"}</p>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
