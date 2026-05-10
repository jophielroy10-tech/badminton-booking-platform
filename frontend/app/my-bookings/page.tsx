"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import toast from "react-hot-toast";
import { AlertCircle, Calendar, CheckCircle, Clock, CreditCard, MapPin, QrCode, XCircle } from "lucide-react";
import { Booking, cancelBooking, getCancelBookingPreview, getMyBookings, getToken } from "@/lib/api";
import BackButton from "@/components/ui/BackButton";
import { BookingCardSkeleton } from "@/components/ui/Skeleton";

const tabs = ["Upcoming", "Past", "Cancelled", "Refunded", "All"] as const;
type Tab = (typeof tabs)[number];

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("Upcoming");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    loadBookings();
  }, []);

  async function loadBookings() {
    const token = getToken();
    if (!token) {
      setLoginRequired(true);
      setLoading(false);
      return;
    }

    try {
      const response = await getMyBookings();
      setBookings(Array.isArray(response) ? response : response?.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load bookings";
      setError(message.toLowerCase().includes("token") || message.toLowerCase().includes("authentication") ? "Session expired. Please login again." : message);
    } finally {
      setLoading(false);
    }
  }

  const filteredBookings = useMemo(() => {
    const now = new Date();
    return bookings.filter((booking) => {
      const start = new Date(booking.slot.startTime);
      const end = new Date(booking.slot.endTime);
      if (activeTab === "Upcoming") return ["CONFIRMED", "PENDING"].includes(booking.status) && start > now;
      if (activeTab === "Past") return booking.status === "COMPLETED" || end < now;
      if (activeTab === "Cancelled") return booking.status === "CANCELLED";
      if (activeTab === "Refunded") return booking.status === "REFUNDED" || ["REFUNDED", "REFUND_PENDING"].includes(booking.payment?.status);
      return true;
    });
  }, [activeTab, bookings]);

  async function handleCancelBooking(bookingId: string) {
    setCancellingId(bookingId);
    try {
      const previewResponse = await getCancelBookingPreview(bookingId);
      const preview = previewResponse.data;
      if (!preview) throw new Error("Unable to calculate cancellation charge");
      const confirmed = confirm(
        `Cancel Booking?\n\nThis court has a cancellation charge of ${preview.cancellationChargePercent}%. If you cancel, Rs. ${preview.cancellationCharge} will be deducted and Rs. ${preview.refundAmount} will be refunded.\n\nChoose OK to cancel or Cancel to keep booking.`
      );
      if (!confirmed) return;
      const response = await cancelBooking(bookingId);
      const data = response.data;
      toast.success(data ? `Booking cancelled. Refund Rs. ${data.refundAmount}, charge Rs. ${data.cancellationCharge}.` : "Booking cancelled successfully");
      await loadBookings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel booking");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <main className="page-shell">
      <BackButton />
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">My Bookings</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-300">Track your court bookings and manage reservations.</p>

      {loginRequired && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-700 dark:text-slate-300">Please login to view your bookings</p>
          <Link href="/login" className="btn-primary mt-4">Login</Link>
        </div>
      )}

      {!loginRequired && (
        <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={activeTab === tab ? "btn-primary whitespace-nowrap" : "btn-secondary whitespace-nowrap"}>
              {tab}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="mt-6 grid gap-4">
          <BookingCardSkeleton />
          <BookingCardSkeleton />
          <BookingCardSkeleton />
        </div>
      )}
      {error && <p className="mt-6 rounded-md bg-red-50 p-4 text-red-700">{error}</p>}
      {!loading && !error && !loginRequired && bookings.length === 0 && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-600 dark:text-slate-300">No bookings yet.</p>
          <Link href="/courts" className="btn-primary mt-4">Find Courts</Link>
        </div>
      )}
      {!loading && !error && !loginRequired && bookings.length > 0 && filteredBookings.length === 0 && (
        <p className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          No {activeTab.toLowerCase()} bookings
        </p>
      )}

      <div className="mt-6 grid gap-4">
        {filteredBookings.map((booking) => (
          <BookingCard key={booking.id} booking={booking} cancelling={cancellingId === booking.id} onCancel={() => handleCancelBooking(booking.id)} />
        ))}
      </div>
    </main>
  );
}

function BookingCard({ booking, cancelling, onCancel }: { booking: Booking; cancelling: boolean; onCancel: () => void }) {
  const canCancel = booking.status === "CONFIRMED" && !booking.checkedIn;
  const refund = booking.refund ?? booking.payment?.refund ?? null;
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          <Info icon={<MapPin className="h-5 w-5" />} title={booking.court.name} text={`${booking.court.address}`} />
          <Info icon={<Calendar className="h-5 w-5" />} title={new Date(booking.slot.date).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} text={`${time(booking.slot.startTime)} - ${time(booking.slot.endTime)}`} />
          <Info icon={<CreditCard className="h-5 w-5" />} title={`Rs. ${booking.payment?.finalAmount ?? 0}`} text={`Payment: ${booking.payment?.status ?? "NA"}`} />
          <Info icon={<Clock className="h-5 w-5" />} title={`Booking: ${booking.status}`} text={`Created ${new Date(booking.createdAt).toLocaleDateString("en-IN")}`} />
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${statusColor(booking.status)}`}>
            {statusIcon(booking.status)}
            {booking.status}
          </span>
          {canCancel && (
            <button onClick={onCancel} disabled={cancelling} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {cancelling ? "Cancelling..." : "Cancel Booking"}
            </button>
          )}
        </div>
      </div>

      {booking.status === "CONFIRMED" && (
        <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5 dark:border-slate-800 sm:grid-cols-2">
          {booking.checkInOtp && (
            <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Check-in OTP</p>
              <p className="mt-1 font-mono text-xl font-bold text-blue-700 dark:text-blue-300">{booking.checkInOtp}</p>
            </div>
          )}
          {booking.qrToken && (
            <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/20">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100"><QrCode className="h-4 w-4" /> Check-in QR</p>
              <div className="inline-block rounded bg-white p-2"><QRCodeCanvas value={booking.qrToken} size={80} /></div>
            </div>
          )}
        </div>
      )}
      {booking.status === "CANCELLED" && (
        <div className="mt-5 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          <p className="font-semibold">Booking cancelled</p>
          <p className="mt-1">Cancellation charge: Rs. {refund?.cancellationCharge ?? 0}</p>
          <p>Refund amount: Rs. {refund?.amount ?? 0}</p>
          <p>Refund status: {refund?.amount ? "PENDING_OWNER_REFUND" : "NO_REFUND_NEEDED"}</p>
        </div>
      )}
    </article>
  );
}

function Info({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div>
        <p className="font-semibold text-slate-950 dark:text-white">{title}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{text}</p>
      </div>
    </div>
  );
}

function time(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function statusColor(status: string) {
  if (status === "CONFIRMED") return "bg-green-100 text-green-800";
  if (status === "PENDING") return "bg-yellow-100 text-yellow-800";
  if (["CANCELLED", "FAILED"].includes(status)) return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
}

function statusIcon(status: string) {
  if (status === "CONFIRMED") return <CheckCircle className="h-4 w-4" />;
  if (status === "CANCELLED") return <XCircle className="h-4 w-4" />;
  if (status === "PENDING") return <Clock className="h-4 w-4" />;
  return <AlertCircle className="h-4 w-4" />;
}
