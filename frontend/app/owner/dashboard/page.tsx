"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getOwnerBookings, getOwnerCourts, getOwnerCurrentSettlement, getOwnerDashboard, getOwnerSettlementSummary, getToken, type Booking, type Court, type OwnerMonthlySettlement } from "@/lib/api";

type OwnerStats = {
  totalCourts: number;
  activeCourts: number;
  totalBookings: number;
  totalRevenue: number;
  slotSummaryToday?: {
    available: number;
    booked: number;
    blocked: number;
    pendingPaymentHolds?: number;
  };
  settlementSummaryToday?: {
    todayNet: number;
    todayPending: number;
    todayPaid: number;
  };
  pendingSettlementToAdmin?: {
    totalPending: number;
    todayPending: number;
    monthPending: number;
  };
};

function readStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function OwnerDashboardPage() {
  const [stats, setStats] = useState<OwnerStats>({ totalCourts: 0, activeCourts: 0, totalBookings: 0, totalRevenue: 0 });
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [settlement, setSettlement] = useState<OwnerMonthlySettlement | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "login" | "denied" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    const user = readStoredUser();
    if (!token) {
      setState("login");
      return;
    }
    if (user?.role !== "OWNER") {
      setState("denied");
      return;
    }

    Promise.all([getOwnerDashboard(), getOwnerCourts(), getOwnerBookings(), getOwnerCurrentSettlement(), getOwnerSettlementSummary()])
      .then(([dashboardResponse, courtsResponse, bookingsResponse, settlementResponse, settlementSummaryResponse]) => {
        const dashboard = dashboardResponse.data ?? { totalCourts: 0, activeCourts: 0, totalBookings: 0, totalRevenue: 0 };
        setStats({
          ...dashboard,
          settlementSummaryToday: {
            todayNet: settlementSummaryResponse.data?.todayNet ?? 0,
            todayPending: settlementSummaryResponse.data?.todayPending ?? 0,
            todayPaid: settlementSummaryResponse.data?.todayPaid ?? 0
          },
          pendingSettlementToAdmin: {
            totalPending: settlementSummaryResponse.data?.totalPending?.pendingAmount ?? settlementSummaryResponse.data?.pendingAmount ?? 0,
            todayPending: settlementSummaryResponse.data?.daily?.pendingAmount ?? settlementSummaryResponse.data?.todayPending ?? 0,
            monthPending: settlementSummaryResponse.data?.monthly?.pendingAmount ?? settlementSummaryResponse.data?.monthPending ?? 0
          }
        });
        setCourts(courtsResponse.data ?? []);
        setBookings(bookingsResponse.data ?? []);
        setSettlement(settlementResponse.data ?? null);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to load owner dashboard");
        setState("error");
      });
  }, []);

  return (
    <main className="page-shell">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Owner Dashboard</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Manage courts, bookings, revenue, and settings.</p>
        </div>
        <Link href="/owner/courts/new" className="btn-primary w-full sm:w-auto">Add Court</Link>
      </div>

      {state === "login" && <AccessCard message="Please login with an owner account." />}
      {state === "denied" && <p className="mt-6 rounded-md bg-red-50 p-4 text-red-700">Access denied. Owner account required.</p>}
      {state === "loading" && <p className="mt-6 surface-card text-slate-600 dark:text-slate-300">Loading owner dashboard...</p>}
      {state === "error" && <p className="mt-6 rounded-md bg-red-50 p-4 text-red-700">{error}</p>}

      {state === "ready" && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NavCard href="/owner/users" title="Users" />
            <NavCard href="/owner/settlements" title="Settlements" />
            <NavCard href="/owner/payments" title="Payments" />
            <NavCard href="/owner/courts" title="Courts" />
            <NavCard href="/owner/slots" title="Slots" />
            <NavCard href="/owner/bookings" title="Bookings" />
            <NavCard href="/owner/revenue" title="Revenue" />
            <NavCard href="/owner/settings" title="Settings" />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Courts" value={stats.totalCourts} />
            <Stat label="Active Courts" value={stats.activeCourts} />
            <Stat label="Bookings" value={stats.totalBookings} />
            <Stat label="Revenue" value={`Rs. ${stats.totalRevenue}`} />
            <Stat label="Available Slots Today" value={stats.slotSummaryToday?.available ?? 0} />
            <Stat label="Booked Slots Today" value={stats.slotSummaryToday?.booked ?? 0} />
            <Stat label="Blocked Slots Today" value={stats.slotSummaryToday?.blocked ?? 0} />
            <Stat label="Pending Payment Holds" value={stats.slotSummaryToday?.pendingPaymentHolds ?? 0} />
            <Stat label="Today's Settlement" value={`Rs. ${stats.settlementSummaryToday?.todayNet ?? 0}`} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="surface-card">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Pending Settlement to Admin</h2>
              <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">Rs. {stats.pendingSettlementToAdmin?.totalPending ?? 0}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Today pending: Rs. {stats.pendingSettlementToAdmin?.todayPending ?? 0} | Month pending: Rs. {stats.pendingSettlementToAdmin?.monthPending ?? 0}
              </p>
              <Link href="/owner/settlements" className="btn-primary mt-4 w-full sm:w-auto">Pay Now</Link>
            </section>

            <section className="surface-card">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Today's settlement</h2>
              <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">Rs. {stats.settlementSummaryToday?.todayNet ?? 0}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Pending: Rs. {stats.settlementSummaryToday?.todayPending ?? 0} | Paid: Rs. {stats.settlementSummaryToday?.todayPaid ?? 0}
              </p>
              <Link href="/owner/settlements" className="btn-primary mt-4 w-full sm:w-auto">View Settlements</Link>
            </section>

            <section className="surface-card">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Manage Slots</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Create 1-hour slots, block days, and manage court availability.</p>
              <Link href="/owner/slots" className="btn-primary mt-4 w-full sm:w-auto">Open Slot Manager</Link>
            </section>

            <section className="surface-card">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Monthly Platform Commission</h2>
              {settlement ? (
                <>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{settlement.message}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Stat label="This month revenue" value={`Rs. ${settlement.monthlyRevenue}`} />
                    <Stat label="Amount to pay" value={`Rs. ${settlement.amountDue}`} />
                  </div>
                  <p className="mt-3 break-all text-sm text-slate-600 dark:text-slate-300">Admin UPI: <span className="font-semibold">{settlement.adminUpiId || "Not set"}</span></p>
                  <Link href="/owner/settlements" className="btn-primary mt-4 w-full sm:w-auto">View Settlements</Link>
                </>
              ) : <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Settlement unavailable.</p>}
            </section>

            <section className="surface-card">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Recent Courts</h2>
                <Link href="/owner/courts" className="text-sm font-semibold text-emerald-600">View all</Link>
              </div>
              <div className="mt-4 space-y-3">
                {courts.slice(0, 5).map((court) => (
                  <div key={court.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-medium text-slate-950 dark:text-white">{court.name}</p>
                      <p className="break-words text-sm text-slate-600 dark:text-slate-300">{court.area}, {court.city}</p>
                    </div>
                    <span className="text-xs font-bold uppercase text-slate-500">{court.isApproved ? "Approved" : "Pending"}</span>
                  </div>
                ))}
                {courts.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-300">No courts yet.</p>}
              </div>
            </section>

            <section className="surface-card">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Recent Bookings</h2>
                <Link href="/owner/bookings" className="text-sm font-semibold text-emerald-600">View all</Link>
              </div>
              <div className="mt-4 space-y-3">
                {bookings.slice(0, 5).map((booking) => (
                  <div key={booking.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <p className="font-medium text-slate-950 dark:text-white">{booking.court.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{booking.user?.name ?? "Guest"} · {booking.status}</p>
                  </div>
                ))}
                {bookings.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-300">No bookings yet.</p>}
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}

function NavCard({ href, title }: { href: string; title: string }) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-800 transition hover:border-emerald-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
      {title}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="surface-card">
      <p className="text-sm text-slate-600 dark:text-slate-300">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{value}</p>
    </div>
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
