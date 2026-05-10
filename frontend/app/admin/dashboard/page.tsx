"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAdminActivitySummary, getAdminBookings, getAdminDashboard, getAdminSettlementSummary, getAdminUsers, getToken, type ActivitySummary, type AuthUser, type Booking, type SettlementSummary } from "@/lib/api";

type AdminStats = {
  users: number;
  owners: number;
  courts: number;
  bookings: number;
  revenue: number;
};

function readStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats>({ users: 0, owners: 0, courts: 0, bookings: 0, revenue: 0 });
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [settlementSummary, setSettlementSummary] = useState<SettlementSummary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "login" | "denied" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    const user = readStoredUser();
    if (!token) {
      setState("login");
      return;
    }
    if (user?.role !== "ADMIN") {
      setState("denied");
      return;
    }

    Promise.all([getAdminDashboard(), getAdminUsers(), getAdminBookings(), getAdminActivitySummary(), getAdminSettlementSummary()])
      .then(([dashboardResponse, usersResponse, bookingsResponse, activityResponse, settlementResponse]) => {
        setStats(dashboardResponse.data ?? { users: 0, owners: 0, courts: 0, bookings: 0, revenue: 0 });
        setUsers(usersResponse.data ?? []);
        setBookings(bookingsResponse.data ?? []);
        setActivitySummary(activityResponse.data ?? null);
        setSettlementSummary(settlementResponse.data ?? null);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to load admin dashboard");
        setState("error");
      });
  }, []);

  return (
    <main className="page-shell">
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Admin Dashboard</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Review users, owners, courts, bookings, payments, refunds, and audit logs.</p>

      {state === "login" && <AccessCard message="Please login with an admin account." />}
      {state === "denied" && <p className="mt-6 rounded-md bg-red-50 p-4 text-red-700">Access denied. Admin account required.</p>}
      {state === "loading" && <p className="mt-6 surface-card text-slate-600 dark:text-slate-300">Loading admin dashboard...</p>}
      {state === "error" && <p className="mt-6 rounded-md bg-red-50 p-4 text-red-700">{error}</p>}

      {state === "ready" && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NavCard href="/admin/users" title="Manage Users" />
            <NavCard href="/admin/owners" title="Manage Owners" />
            <NavCard href="/admin/courts" title="Court Approvals" highlight />
            <NavCard href="/admin/bookings" title="Bookings" />
            <NavCard href="/admin/payments" title="Payments" />
            <NavCard href="/admin/refunds" title="Refunds" />
            <NavCard href="/admin/activity" title="Activity" highlight />
            <NavCard href="/admin/settlements" title="Settlements" />
            <NavCard href="/admin/audit-logs" title="Audit Logs" />
            <NavCard href="/admin/settings" title="Settings" />
          </div>
          <Link href="/admin/courts" className="btn-primary mt-4 w-full sm:w-auto">Review Court Approvals</Link>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Users" value={stats.users} />
            <Stat label="Owners" value={stats.owners} />
            <Stat label="Courts" value={stats.courts} />
            <Stat label="Bookings" value={stats.bookings} />
            <Stat label="Revenue" value={`Rs. ${stats.revenue}`} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="surface-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Owner Settlements</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Track owner payout settlements.</p>
                </div>
                <Link href="/admin/settlements" className="btn-primary w-full shrink-0 sm:w-auto">Manage Settlements</Link>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Stat label="Pending payout" value={`Rs. ${settlementSummary?.totalPendingSettlement ?? 0}`} />
                <Stat label="Paid payout" value={`Rs. ${settlementSummary?.totalPaidSettlement ?? 0}`} />
                <Stat label="Today pending" value={`Rs. ${settlementSummary?.todayPending ?? 0}`} />
                <Stat label="Pending count" value={settlementSummary?.totalPendingCount ?? 0} />
              </div>
            </section>

            <section className="surface-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Activity Monitor</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">See user, owner, admin, booking and payment activities.</p>
                </div>
                <Link href="/admin/activity" className="btn-primary w-full shrink-0 sm:w-auto">View Activity</Link>
              </div>
              <div className="mt-4 space-y-3">
                {(activitySummary?.recentActivities ?? []).slice(0, 5).map((activity) => (
                  <div key={activity.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <p className="font-medium text-slate-950 dark:text-white">{activity.action}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{activity.user?.email ?? "System"} · {new Date(activity.createdAt).toLocaleString("en-IN")}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="surface-card">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Recent Users</h2>
                <Link href="/admin/users" className="text-sm font-semibold text-emerald-600">View all</Link>
              </div>
              <div className="mt-4 space-y-3">
                {users.slice(0, 6).map((user) => (
                  <div key={user.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-medium text-slate-950 dark:text-white">{user.name}</p>
                      <p className="break-all text-sm text-slate-600 dark:text-slate-300">{user.email}</p>
                    </div>
                    <span className="text-xs font-bold uppercase text-slate-500">{user.role}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="surface-card">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Recent Bookings</h2>
                <Link href="/admin/bookings" className="text-sm font-semibold text-emerald-600">View all</Link>
              </div>
              <div className="mt-4 space-y-3">
                {bookings.slice(0, 6).map((booking) => (
                  <div key={booking.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <p className="font-medium text-slate-950 dark:text-white">{booking.court.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{booking.user?.name ?? "Guest"} · {booking.status}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="surface-card">
      <p className="text-sm text-slate-600 dark:text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function NavCard({ href, title, highlight = false }: { href: string; title: string; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-lg border p-4 text-sm font-semibold transition ${
        highlight
          ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
          : "border-slate-200 bg-white text-slate-800 hover:border-emerald-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
      }`}
    >
      {title}
    </Link>
  );
}

function AccessCard({ message }: { message: string }) {
  return (
    <div className="mt-6 surface-card">
      <p className="text-slate-700 dark:text-slate-300">{message}</p>
      <Link href="/login" className="btn-primary mt-4">Login</Link>
    </div>
  );
}
