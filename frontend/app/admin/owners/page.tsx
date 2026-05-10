"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { KeyRound, Trash2 } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { deleteAdminOwner, getAdminOwners, type AuthUser } from "@/lib/api";
import ResetPasswordModal from "@/components/admin/ResetPasswordModal";

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

export default function AdminOwnersPage() {
  const [owners, setOwners] = useState<AuthUser[]>([]);
  const [selected, setSelected] = useState<AuthUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AuthUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getAdminOwners().then((response) => setOwners(response.data ?? [])).catch(() => setOwners([]));
  }, []);

  async function confirmDelete() {
    if (!selected) return;
    setDeleting(true);
    try {
      await deleteAdminOwner(selected.id);
      setOwners((items) => items.map((owner) => owner.id === selected.id ? { ...owner, status: "DELETED", deletedAt: new Date().toISOString() } : owner));
      toast.success("Owner deleted successfully");
      setSelected(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete owner");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="page-shell">
      <BackButton fallback="/admin/dashboard" />
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Admin Owners</h1>
      {owners.length === 0 && <p className="mt-6 surface-card text-slate-600 dark:text-slate-300">No owners found.</p>}
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {owners.map((owner) => (
          <article key={owner.id} className="surface-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="break-words font-semibold text-slate-950 dark:text-white">{owner.name}</p>
                <p className="break-all text-sm text-slate-600 dark:text-slate-300">{owner.email}</p>
              </div>
              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold dark:bg-slate-800">{owner.status || "ACTIVE"}</span>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Courts: <span className="font-semibold">{owner.courtsCount ?? 0}</span></p>
            <p className="mt-1 text-xs text-slate-500">Created {formatDate(owner.createdAt)}</p>
            <div className="mt-4 grid gap-2">
              <button className="btn-secondary min-h-11 w-full" disabled={owner.status === "DELETED"} onClick={() => setResetTarget(owner)}>
                <KeyRound className="h-4 w-4" /> Reset Password
              </button>
              <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50" disabled={owner.status === "DELETED"} onClick={() => setSelected(owner)}>
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          </article>
        ))}
      </div>
      <ConfirmDialog open={Boolean(selected)} title="Delete owner" description="Deleting this owner will deactivate all their courts. Continue?" confirmText="Delete owner" onConfirm={confirmDelete} onCancel={() => setSelected(null)} loading={deleting} />
      <ResetPasswordModal target={resetTarget} onClose={() => setResetTarget(null)} />
    </main>
  );
}
