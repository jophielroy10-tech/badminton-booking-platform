"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BackButton from "@/components/ui/BackButton";
import { BookingCardSkeleton } from "@/components/ui/Skeleton";
import { getOwnerUsers, type OwnerCourtUser } from "@/lib/api";

export default function OwnerUsersPage() {
  const [users, setUsers] = useState<OwnerCourtUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getOwnerUsers()
      .then((response) => setUsers(response.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load court users"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase())), [query, users]);

  return (
    <main className="page-shell">
      <BackButton fallback="/owner/dashboard" />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Court Users</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-300">Users shown here have booked your courts.</p>
        </div>
        <input className="field max-w-sm" placeholder="Search by name or email" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      {loading && <div className="mt-6 grid gap-4 md:grid-cols-2"><BookingCardSkeleton /><BookingCardSkeleton /><BookingCardSkeleton /><BookingCardSkeleton /></div>}
      {error && <p className="mt-6 rounded-md bg-red-50 p-4 text-red-700">{error}</p>}
      {!loading && !error && filtered.length === 0 && <p className="mt-6 surface-card text-slate-600 dark:text-slate-300">No court users found.</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((user) => (
          <article key={user.id} className="surface-card">
            <h2 className="font-semibold text-slate-950 dark:text-white">{user.name}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">{user.email}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Metric label="Bookings" value={user.totalBookings} />
              <Metric label="Paid" value={`Rs. ${user.totalAmountPaid}`} />
              <Metric label="Confirmed" value={user.confirmedBookings} />
              <Metric label="Cancelled" value={user.cancelledBookings} />
            </div>
            <p className="mt-4 text-xs text-slate-500">Last booking {user.lastBookingDate ? new Date(user.lastBookingDate).toLocaleDateString("en-IN") : "-"}</p>
            <Link href={`/owner/users/${user.id}`} className="btn-primary mt-4 w-full">View Details</Link>
          </article>
        ))}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}
