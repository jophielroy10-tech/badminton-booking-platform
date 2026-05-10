"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import BackButton from "@/components/ui/BackButton";
import { BookingCardSkeleton } from "@/components/ui/Skeleton";
import { getOwnerUserDetails, type OwnerCourtUserDetails } from "@/lib/api";

export default function OwnerUserDetailsPage() {
  const params = useParams<{ id: string }>();
  const [details, setDetails] = useState<OwnerCourtUserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getOwnerUserDetails(params.id)
      .then((response) => setDetails(response.data ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load user details"))
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <main className="page-shell">
      <BackButton fallback="/owner/users" />
      {loading && <div className="mt-6 grid gap-4"><BookingCardSkeleton /><BookingCardSkeleton /></div>}
      {error && <p className="mt-6 rounded-md bg-red-50 p-4 text-red-700">{error}</p>}
      {!loading && !error && !details && <p className="surface-card text-slate-600 dark:text-slate-300">No bookings found for this user.</p>}

      {details && (
        <>
          <section className="surface-card">
            <h1 className="text-3xl font-bold text-slate-950 dark:text-white">{details.user.name}</h1>
            <p className="mt-1 text-slate-600 dark:text-slate-300">{details.user.email}</p>
            <p className="mt-2 text-xs text-slate-500">Joined {details.user.createdAt ? new Date(details.user.createdAt).toLocaleDateString("en-IN") : "-"}</p>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Bookings" value={details.summary.totalBookings} />
            <Stat label="Confirmed" value={details.summary.confirmedBookings} />
            <Stat label="Cancelled" value={details.summary.cancelledBookings} />
            <Stat label="Paid" value={`Rs. ${details.summary.totalAmountPaid}`} />
          </section>

          <section className="mt-6 surface-card">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Booking History</h2>
            {details.bookings.length === 0 && <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No bookings yet.</p>}
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">Court</th>
                    <th className="py-2">Date</th>
                    <th className="py-2">Time</th>
                    <th className="py-2">Booking</th>
                    <th className="py-2">Payment</th>
                    <th className="py-2">Amount</th>
                    <th className="py-2">Check-in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {details.bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="py-3 font-medium">{booking.court.name}</td>
                      <td className="py-3">{new Date(booking.slot.date).toLocaleDateString("en-IN")}</td>
                      <td className="py-3">{time(booking.slot.startTime)} - {time(booking.slot.endTime)}</td>
                      <td className="py-3">{booking.status}</td>
                      <td className="py-3">{booking.paymentStatus ?? "-"}</td>
                      <td className="py-3">Rs. {booking.finalAmount}</td>
                      <td className="py-3">{booking.checkedIn ? "Checked in" : "Pending"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="surface-card"><p className="text-sm text-slate-600 dark:text-slate-300">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</p></div>;
}

function time(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
