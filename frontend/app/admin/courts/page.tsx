"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { approveAdminCourt, deleteAdminCourt, getAdminCourts, getToken, rejectAdminCourt, updateAdminCourtUpi, type Court } from "@/lib/api";
import BackButton from "@/components/ui/BackButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import { CourtCardSkeleton } from "@/components/ui/Skeleton";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import { getCourtPrimaryImage, getImageUrl } from "@/lib/image";
import { imageAccept, validateImageFile } from "@/lib/upload";

const tabs = [
  ["PENDING_APPROVAL", "Pending Approval"],
  ["ACTIVE", "Approved Courts"],
  ["REJECTED", "Rejected Courts"],
  ["INACTIVE", "Inactive Courts"]
] as const;

function approvalLabel(court: Court) {
  if (court.deletedAt) return "Deleted";
  return court.isApproved ? "Approved" : "Not approved";
}

export default function AdminCourtsPage() {
  const router = useRouter();
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number][0]>("PENDING_APPROVAL");
  const [rejecting, setRejecting] = useState<Court | null>(null);
  const [viewing, setViewing] = useState<Court | null>(null);
  const [deletingCourt, setDeletingCourt] = useState<Court | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState("");
  const [editingUpi, setEditingUpi] = useState<Court | null>(null);
  const [upiId, setUpiId] = useState("");
  const [upiQrImage, setUpiQrImage] = useState<File | null>(null);

  async function load() {
    const response = await getAdminCourts();
    setCourts(response.data ?? []);
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
      .catch(() => setError("Failed to load courts"))
      .finally(() => setLoading(false));
  }, [router]);

  const visibleCourts = useMemo(() => courts.filter((court) => court.status === activeTab), [courts, activeTab]);

  async function approve(id: string) {
    try {
      await approveAdminCourt(id);
      toast.success("Court approved successfully");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve court");
    }
  }

  async function reject() {
    if (!rejecting) return;
    try {
      await rejectAdminCourt(rejecting.id, reason);
      toast.success("Court rejected");
      setRejecting(null);
      setReason("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject court");
    }
  }

  async function confirmDelete() {
    if (!deletingCourt) return;
    setDeleting(true);
    try {
      await deleteAdminCourt(deletingCourt.id);
      toast.success("Court deleted successfully");
      setDeletingCourt(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete court");
    } finally {
      setDeleting(false);
    }
  }

  async function saveUpi() {
    if (!editingUpi) return;
    try {
      const formData = new FormData();
      formData.append("upiId", upiId);
      if (upiQrImage) formData.append("upiQrImage", upiQrImage);
      await updateAdminCourtUpi(editingUpi.id, formData);
      toast.success("Court UPI details updated");
      setEditingUpi(null);
      setUpiQrImage(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update UPI details");
    }
  }

  return (
    <main className="page-shell">
      <BackButton fallback="/admin/dashboard" />
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Admin Courts</h1>
      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {tabs.map(([status, label]) => (
          <button key={status} className={`${activeTab === status ? "btn-primary" : "btn-secondary"} whitespace-nowrap`} onClick={() => setActiveTab(status)}>
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <CourtCardSkeleton />
          <CourtCardSkeleton />
          <CourtCardSkeleton />
          <CourtCardSkeleton />
        </div>
      )}
      {error && <p className="mt-6 rounded-md bg-red-50 p-4 text-red-700">{error}</p>}
      {!loading && !error && visibleCourts.length === 0 && (
        <p className="mt-6 surface-card text-slate-600 dark:text-slate-300">
          {activeTab === "PENDING_APPROVAL" ? "No pending courts for approval" : "No courts in this section"}
        </p>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {visibleCourts.map((court) => (
          <article key={court.id} className="surface-card">
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-100 sm:aspect-square">
                <ImageWithFallback src={getCourtPrimaryImage(court)} alt={court.name} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{court.name}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{court.owner?.name} - {court.owner?.email}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{court.address}, {court.area}, {court.city}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Court Contact: {court.contactMobile || "Mobile number not added"}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Rs. {court.pricePerHour}/hour - {court.type || "Court"} - {court.hasAC ? "AC" : "Non AC"} - {court.hasCoaching ? "Coaching" : "No coaching"}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  <Metric label="Bookings" value={court.analytics?.totalBookings ?? 0} />
                  <Metric label="Success" value={court.analytics?.successfulPayments ?? 0} />
                  <Metric label="Revenue" value={`Rs. ${court.analytics?.totalRevenue ?? 0}`} />
                  <Metric label="Pending" value={court.analytics?.pendingPayments ?? 0} />
                  <Metric label="Cancelled" value={court.analytics?.cancelledBookings ?? 0} />
                  <Metric label="Owner Net" value={`Rs. ${court.analytics?.ownerNetEarning ?? 0}`} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold uppercase">
                  <span className="rounded bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{court.status}</span>
                  <span className="rounded bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{approvalLabel(court)}</span>
                  <span className={court.upiId && court.upiQrImageUrl ? "rounded bg-emerald-50 px-2 py-1 text-emerald-700" : "rounded bg-red-50 px-2 py-1 text-red-700"}>
                    {court.upiId && court.upiQrImageUrl ? "UPI Ready" : "UPI Missing"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">UPI: {court.upiId || "Missing"} - QR: {court.upiQrImageUrl ? "Uploaded" : "Missing"}</p>
                {(!court.upiId || !court.upiQrImageUrl) && <p className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-800">UPI ID and QR code required before approval</p>}
                <p className="mt-1 text-xs text-slate-500">Created {court.createdAt ? new Date(court.createdAt as any).toLocaleString() : ""}</p>
                {court.rejectionReason && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{court.rejectionReason}</p>}
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
              {court.status === "PENDING_APPROVAL" && (
                <>
                  <button className="btn-primary w-full sm:w-auto" disabled={!court.upiId || !court.upiQrImageUrl} title={!court.upiId || !court.upiQrImageUrl ? "UPI ID and QR code required before approval" : ""} onClick={() => approve(court.id)}>Accept</button>
                  <button className="btn-secondary w-full sm:w-auto" onClick={() => setRejecting(court)}>Reject</button>
                </>
              )}
              <Link className="btn-secondary w-full sm:w-auto" href={`/admin/courts/${court.id}`}>View Details</Link>
              <button className="btn-secondary w-full sm:w-auto" onClick={() => { setEditingUpi(court); setUpiId(court.upiId || ""); }}>Edit UPI</button>
              <button className="btn-secondary w-full sm:w-auto" onClick={() => setViewing(court)}>Quick View</button>
              <button className="inline-flex min-h-11 items-center justify-center rounded-md bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50" disabled={Boolean(court.deletedAt)} onClick={() => setDeletingCourt(court)}>Delete</button>
            </div>
          </article>
        ))}
      </div>

      <Modal open={Boolean(rejecting)} title={rejecting ? `Reject ${rejecting.name}` : "Reject court"} onClose={() => setRejecting(null)}>
        <textarea className="field mt-4 min-h-28" placeholder="Rejection reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="btn-secondary" onClick={() => setRejecting(null)}>Back</button>
          <button className="btn-primary" onClick={reject}>Reject Court</button>
        </div>
      </Modal>

      <Modal open={Boolean(editingUpi)} title={editingUpi ? `Edit UPI - ${editingUpi.name}` : "Edit UPI"} onClose={() => setEditingUpi(null)}>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Owner UPI ID
            <input className="field" value={upiId} onChange={(event) => setUpiId(event.target.value)} placeholder="example@okaxis" />
          </label>
          {editingUpi?.upiQrImageUrl && (
            <div className="relative h-48 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800">
              <ImageWithFallback src={getImageUrl(editingUpi.upiQrImageUrl)} alt="Current UPI QR" placeholder="No QR uploaded" contain />
            </div>
          )}
          <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            New QR image
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
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="btn-secondary" onClick={() => setEditingUpi(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveUpi}>Save UPI</button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(viewing)} title={viewing?.name ?? "Court details"} onClose={() => setViewing(null)} maxWidth="max-w-3xl">
        {viewing && (
          <>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{viewing.address}, {viewing.area}, {viewing.city}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {(viewing.images?.length ? viewing.images : viewing.imageUrl ? [{ id: viewing.id, imageUrl: viewing.imageUrl, isPrimary: true, createdAt: viewing.createdAt || "" }] : []).map((image) => (
                <div key={image.id} className="relative aspect-video overflow-hidden rounded-lg bg-slate-100">
                  <ImageWithFallback src={getImageUrl(image.imageUrl)} alt={viewing.name} />
                </div>
              ))}
            </div>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold">Owner</dt><dd>{viewing.owner?.name} - {viewing.owner?.email}</dd></div>
              <div><dt className="font-semibold">Court Contact</dt><dd>{viewing.contactMobile || "Mobile number not added"}</dd></div>
              <div><dt className="font-semibold">Status</dt><dd>{viewing.status}</dd></div>
              <div><dt className="font-semibold">Approval</dt><dd>{approvalLabel(viewing)}</dd></div>
              <div><dt className="font-semibold">Type</dt><dd>{viewing.type || "INDOOR"}</dd></div>
              <div><dt className="font-semibold">Facilities</dt><dd>{viewing.hasAC ? "AC" : "Non AC"} - {viewing.hasCoaching ? "Coaching" : "No coaching"}</dd></div>
              <div><dt className="font-semibold">Hours</dt><dd>{viewing.openingTime || "-"} - {viewing.closingTime || "-"}</dd></div>
              <div><dt className="font-semibold">Price</dt><dd>Rs. {viewing.pricePerHour}/hour</dd></div>
            </dl>
          </>
        )}
      </Modal>

      <ConfirmDialog open={Boolean(deletingCourt)} title="Delete court" description="Are you sure you want to delete this court?" confirmText="Delete court" onConfirm={confirmDelete} onCancel={() => setDeletingCourt(null)} loading={deleting} />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded bg-slate-50 px-2 py-1 dark:bg-slate-950">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
