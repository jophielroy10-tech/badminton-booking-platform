"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import BackButton from "@/components/ui/BackButton";
import Modal from "@/components/ui/Modal";
import { BookingCardSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { approveAdminCourt, getAdminCourtDetails, getToken, rejectAdminCourt, updateAdminCourtUpi, type AdminCourtDetails } from "@/lib/api";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import { getImageUrl } from "@/lib/image";
import { imageAccept, validateImageFile } from "@/lib/upload";

export default function AdminCourtDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [details, setDetails] = useState<AdminCourtDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [editingUpi, setEditingUpi] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [upiQrImage, setUpiQrImage] = useState<File | null>(null);

  async function load() {
    const response = await getAdminCourtDetails(params.id);
    const data = response.data ?? null;
    setDetails(data);
    setUpiId(data?.court.upiId || "");
  }

  useEffect(() => {
    const rawUser = localStorage.getItem("user");
    const user = rawUser ? JSON.parse(rawUser) : null;
    if (!getToken()) {
      router.push("/login");
      return;
    }
    if (user?.role !== "ADMIN") {
      router.push("/");
      return;
    }
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load court details"))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  async function approve() {
    if (!details) return;
    setApproving(true);
    setActionError("");
    try {
      await approveAdminCourt(details.court.id);
      toast.success("Court approved successfully");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve court";
      setActionError(message);
      toast.error(message);
    } finally {
      setApproving(false);
    }
  }

  async function reject() {
    if (!details) return;
    setRejecting(true);
    setActionError("");
    try {
      await rejectAdminCourt(details.court.id, rejectReason);
      toast.success("Court rejected");
      setRejectModalOpen(false);
      setRejectReason("");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reject court";
      setActionError(message);
      toast.error(message);
    } finally {
      setRejecting(false);
    }
  }

  async function saveUpi() {
    if (!details) return;
    try {
      const formData = new FormData();
      formData.append("upiId", upiId);
      if (upiQrImage) formData.append("upiQrImage", upiQrImage);
      await updateAdminCourtUpi(details.court.id, formData);
      toast.success("Court UPI details updated");
      setEditingUpi(false);
      setUpiQrImage(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update UPI details");
    }
  }

  return (
    <main className="page-shell">
      <BackButton fallback="/admin/courts" />
      {loading && <div className="grid gap-4"><Skeleton className="h-64 w-full" /><BookingCardSkeleton /></div>}
      {error && <p className="mt-6 rounded-md bg-red-50 p-4 text-red-700">{error}</p>}
      {actionError && <p className="mt-6 rounded-md bg-red-50 p-4 text-red-700">{actionError}</p>}
      {!loading && !error && !details && <p className="surface-card text-slate-600 dark:text-slate-300">Court not found.</p>}

      {details && (
        <>
          <section className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
            <div className="surface-card">
              <h1 className="text-3xl font-bold text-slate-950 dark:text-white">{details.court.name}</h1>
              <p className="mt-2 text-slate-600 dark:text-slate-300">{details.court.address}, {details.court.area}, {details.court.city}</p>
              <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Court Contact: {details.court.contactMobile || "Mobile number not added"}</p>
              {details.court.mapUrl && <a className="btn-secondary mt-3 inline-flex" href={details.court.mapUrl} target="_blank" rel="noreferrer">Open Map</a>}
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{details.court.description}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase">
                <span className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">{details.court.status}</span>
                <span className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">{details.court.isApproved ? "Approved" : "Not approved"}</span>
                <span className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">Rs. {details.court.pricePerHour}/hour</span>
                <span className={details.court.upiId && details.court.upiQrImageUrl ? "rounded bg-emerald-50 px-2 py-1 text-emerald-700" : "rounded bg-red-50 px-2 py-1 text-red-700"}>
                  {details.court.upiId && details.court.upiQrImageUrl ? "UPI Ready" : "UPI Missing"}
                </span>
              </div>
              {details.court.status === "PENDING_APPROVAL" && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button className="btn-primary" disabled={approving || !details.court.upiId || !details.court.upiQrImageUrl} title={!details.court.upiId || !details.court.upiQrImageUrl ? "UPI ID and QR code required before approval" : ""} onClick={approve}>
                    {approving ? "Approving..." : "Approve"}
                  </button>
                  <button className="btn-secondary" disabled={rejecting} onClick={() => setRejectModalOpen(true)}>Reject</button>
                </div>
              )}
              {(!details.court.upiId || !details.court.upiQrImageUrl) && <p className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-800">UPI ID and QR code required before approval</p>}
              <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {(details.court.images?.length ? details.court.images : details.court.imageUrl ? [{ id: details.court.id, imageUrl: details.court.imageUrl, isPrimary: true, createdAt: "" }] : []).map((image) => (
                  <div key={image.id} className="relative aspect-video overflow-hidden rounded-lg bg-slate-100">
                    <ImageWithFallback src={getImageUrl(image.imageUrl)} alt={details.court.name} />
                  </div>
                ))}
              </div>
            </div>
            <div className="surface-card">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Owner</h2>
              <p className="mt-3 font-medium text-slate-950 dark:text-white">{details.owner.name}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{details.owner.email}</p>
              <p className="mt-2 text-xs font-semibold uppercase text-slate-500">{details.owner.status}</p>
            </div>
          </section>

          <section className="mt-6 surface-card">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Contact Details</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div><dt className="font-semibold">Court Contact</dt><dd>{details.court.contactMobile || "Mobile number not added"}</dd></div>
              <div><dt className="font-semibold">Owner Name</dt><dd>{details.owner.name}</dd></div>
              <div><dt className="font-semibold">Owner Email</dt><dd>{details.owner.email}</dd></div>
              <div><dt className="font-semibold">Address</dt><dd>{details.court.address}</dd></div>
              <div><dt className="font-semibold">City</dt><dd>{details.court.city}</dd></div>
              <div><dt className="font-semibold">Area</dt><dd>{details.court.area || "-"}</dd></div>
              <div><dt className="font-semibold">Price</dt><dd>Rs. {details.court.pricePerHour}/hour</dd></div>
              <div><dt className="font-semibold">Status</dt><dd>{details.court.status}</dd></div>
              <div><dt className="font-semibold">Approval</dt><dd>{details.court.isApproved ? "Approved" : "Not approved"}</dd></div>
              <div><dt className="font-semibold">UPI ID</dt><dd>{details.court.upiId || "Missing"}</dd></div>
              <div><dt className="font-semibold">Map URL</dt><dd>{details.court.mapUrl || "-"}</dd></div>
              <div><dt className="font-semibold">Images</dt><dd>{details.court.images?.length || (details.court.imageUrl ? 1 : 0)}</dd></div>
            </dl>
          </section>

          <section className="mt-6 surface-card">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Court Owner UPI</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{details.court.upiId || "Missing"}</p>
                {details.court.upiUpdatedAt && <p className="mt-1 text-xs text-slate-500">Updated {new Date(details.court.upiUpdatedAt).toLocaleString()}</p>}
              </div>
              <button className="btn-secondary" onClick={() => setEditingUpi(true)}>Edit UPI</button>
            </div>
            {details.court.upiQrImageUrl && (
              <div className="relative mt-4 h-56 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800">
                <ImageWithFallback src={getImageUrl(details.court.upiQrImageUrl)} alt="Court owner UPI QR" placeholder="No QR uploaded" contain />
              </div>
            )}
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Revenue" value={`Rs. ${details.analytics.totalRevenue}`} />
            <Stat label="Bookings" value={details.analytics.totalBookings} />
            <Stat label="Users" value={details.analytics.totalUsers ?? 0} />
            <Stat label="Successful Payments" value={details.analytics.successfulPayments} />
            <Stat label="Commission" value={`Rs. ${details.analytics.platformCommission ?? 0}`} />
            <Stat label="Owner Net" value={`Rs. ${details.analytics.ownerNetEarning ?? 0}`} />
            <Stat label="Refunded" value={`Rs. ${details.analytics.refundedAmount ?? 0}`} />
            <Stat label="Cancelled" value={details.analytics.cancelledBookings} />
          </section>

          {details.slotOverview && (
            <section className="mt-6 surface-card">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Slot Overview</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <Stat label="Total slots" value={details.slotOverview.total} />
                <Stat label="Available" value={details.slotOverview.available} />
                <Stat label="Booked" value={details.slotOverview.booked} />
                <Stat label="Blocked" value={details.slotOverview.blocked} />
                <Stat label="Hold" value={details.slotOverview.hold} />
                <Stat label="Today available" value={details.slotOverview.todayAvailability} />
              </div>
            </section>
          )}

          {details.ownerCommissionStatus && (
            <section className="mt-6 surface-card">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Owner Commission Status</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Owner monthly revenue" value={`Rs. ${details.ownerCommissionStatus.ownerMonthlyRevenue}`} />
                <Stat label="This court revenue" value={`Rs. ${details.ownerCommissionStatus.thisCourtRevenue}`} />
                <Stat label="Commission" value={`${details.ownerCommissionStatus.commissionPercent}%`} />
                <Stat label="Amount due" value={`Rs. ${details.ownerCommissionStatus.amountDue}`} />
                <Stat label="Payment status" value={details.ownerCommissionStatus.status} />
                <Stat label="Submitted UTR" value={details.ownerCommissionStatus.paymentUtr || "-"} />
              </div>
            </section>
          )}

          <section className="mt-6 surface-card">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Bookings</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[820px] w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr><th className="py-2">User</th><th>Date</th><th>Time</th><th>Booking</th><th>Payment</th><th>Amount</th><th>Check-in</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {details.bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="py-3"><p className="font-medium">{booking.user.name}</p><p className="text-xs text-slate-500">{booking.user.email}</p></td>
                      <td>{new Date(booking.slot.date).toLocaleDateString("en-IN")}</td>
                      <td>{time(booking.slot.startTime)} - {time(booking.slot.endTime)}</td>
                      <td>{booking.status}</td>
                      <td>{booking.paymentStatus ?? "-"}</td>
                      <td>Rs. {booking.finalAmount}</td>
                      <td>{booking.checkedIn ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {details.bookings.length === 0 && <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No bookings for this court.</p>}
          </section>

          <section className="mt-6 surface-card">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Users</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {details.users.map((user) => (
                <div key={user.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <p className="font-semibold text-slate-950 dark:text-white">{user.name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{user.email}</p>
                  <p className="mt-3 text-sm">Bookings: <span className="font-semibold">{user.bookingCount}</span></p>
                  <p className="text-sm">Paid: <span className="font-semibold">Rs. {user.totalPaid}</span></p>
                  <p className="mt-2 text-xs text-slate-500">Last booking {user.lastBookingDate ? new Date(user.lastBookingDate).toLocaleDateString("en-IN") : "-"}</p>
                </div>
              ))}
            </div>
            {details.users.length === 0 && <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No users have booked this court.</p>}
          </section>
        </>
      )}
      <Modal open={editingUpi} title="Edit court UPI" onClose={() => setEditingUpi(false)}>
        <div className="mt-4 grid gap-4">
          <input className="field" placeholder="example@okaxis" value={upiId} onChange={(event) => setUpiId(event.target.value)} />
          <input
            className="field"
            type="file"
            accept={imageAccept}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              const validationError = file ? validateImageFile(file, "qr") : null;
              if (validationError) {
                toast.error(validationError);
                event.currentTarget.value = "";
                return;
              }
              setUpiQrImage(file);
            }}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="btn-secondary" onClick={() => setEditingUpi(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveUpi}>Save UPI</button>
          </div>
        </div>
      </Modal>
      <Modal open={rejectModalOpen} title="Reject court" onClose={() => setRejectModalOpen(false)}>
        <textarea className="field mt-4 min-h-28" placeholder="Rejection reason" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="btn-secondary" onClick={() => setRejectModalOpen(false)}>Back</button>
          <button className="btn-primary" disabled={rejecting} onClick={reject}>{rejecting ? "Rejecting..." : "Reject Court"}</button>
        </div>
      </Modal>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="surface-card"><p className="text-sm text-slate-600 dark:text-slate-300">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</p></div>;
}

function time(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
