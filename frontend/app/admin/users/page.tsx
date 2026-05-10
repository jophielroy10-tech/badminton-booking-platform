"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import { createAdminUser, deleteAdminUser, getAdminUserStats, getAdminUsers, type AdminUserStats, type AuthUser, type UserRole } from "@/lib/api";
import { isStrongPassword, strongPasswordMessage } from "@/lib/password";
import ResetPasswordModal from "@/components/admin/ResetPasswordModal";

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

const emptyForm = { name: "", email: "", password: "", role: "USER" as UserRole };

function isActiveAdmin(user: AuthUser) {
  return user.role === "ADMIN" && user.status === "ACTIVE" && !user.deletedAt;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [selected, setSelected] = useState<AuthUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AuthUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function refreshUsers() {
    const [usersResponse, statsResponse] = await Promise.all([getAdminUsers(), getAdminUserStats()]);
    setUsers(usersResponse.data ?? []);
    setStats(statsResponse.data ?? null);
  }

  useEffect(() => {
    refreshUsers().catch(() => {
      setUsers([]);
      setStats(null);
    });
  }, []);

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) return toast.error("Name is required");
    if (!isStrongPassword(form.password)) return toast.error(strongPasswordMessage);
    if (form.role === "ADMIN" && stats && !stats.canCreateAdmin) return toast.error("Admin account limit reached. Only 2 admin accounts are allowed.");

    setCreating(true);
    try {
      const response = await createAdminUser({ ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() });
      toast.success(response.message || "Account created successfully");
      setForm(emptyForm);
      setCreateOpen(false);
      await refreshUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setCreating(false);
    }
  }

  async function confirmDelete() {
    if (!selected) return;
    setDeleting(true);
    try {
      await deleteAdminUser(selected.id);
      toast.success("User deleted successfully");
      setSelected(null);
      await refreshUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="page-shell">
      <BackButton fallback="/admin/dashboard" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Admin Users</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Active admin accounts: {stats?.activeAdmins ?? 0} / {stats?.adminLimit ?? 2}
          </p>
        </div>
        <button className="btn-primary min-h-11 w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create Account
        </button>
      </div>
      {users.length === 0 && <p className="mt-6 surface-card text-slate-600 dark:text-slate-300">No users found.</p>}
      <div className="mt-6 grid gap-3">
        {users.map((user) => {
          const deleteDisabledReason = user.status === "DELETED"
            ? "Account is already deleted."
            : isActiveAdmin(user) && (stats?.activeAdmins ?? 0) <= 1
              ? "At least one admin account must remain active."
              : "";

          return (
            <article key={user.id} className="surface-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-slate-950 dark:text-white">{user.name}</p>
                <p className="break-all text-sm text-slate-600 dark:text-slate-300">{user.email}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold uppercase">
                  <span className="rounded bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{user.role}</span>
                  <span className="rounded bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{user.status || "ACTIVE"}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Created {formatDate(user.createdAt)}</p>
                {deleteDisabledReason && user.role === "ADMIN" && <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">{deleteDisabledReason}</p>}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button className="btn-secondary min-h-11" disabled={user.status === "DELETED" || user.role === "ADMIN"} onClick={() => setResetTarget(user)}>
                  <KeyRound className="h-4 w-4" /> Reset Password
                </button>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50"
                  disabled={Boolean(deleteDisabledReason)}
                  title={deleteDisabledReason || "Delete account"}
                  onClick={() => setSelected(user)}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <Modal open={createOpen} title="Create Account" onClose={() => setCreateOpen(false)}>
        <form className="mt-5 grid gap-4" onSubmit={submitCreate}>
          <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Name
            <input className="field" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Email
            <input className="field" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Password
            <input className="field" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
            <span className="text-xs font-normal text-slate-500">{strongPasswordMessage}</span>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Role
            <select className="field" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}>
              <option value="USER">USER</option>
              <option value="OWNER">OWNER</option>
              <option value="ADMIN" disabled={stats ? !stats.canCreateAdmin : false}>ADMIN</option>
            </select>
          </label>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <p>Active admin accounts: {stats?.activeAdmins ?? 0} / {stats?.adminLimit ?? 2}</p>
            {form.role === "ADMIN" && <p className="mt-1">Only 2 active admin accounts are allowed.</p>}
            {stats && !stats.canCreateAdmin && <p className="mt-1 font-semibold text-amber-700 dark:text-amber-300">Admin account limit reached.</p>}
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary min-h-11" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</button>
            <button type="submit" className="btn-primary min-h-11" disabled={creating}>{creating ? "Creating..." : "Create Account"}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(selected)} title="Delete account" description="This will deactivate the account and free an admin slot when deleting an admin." confirmText="Delete account" onConfirm={confirmDelete} onCancel={() => setSelected(null)} loading={deleting} />
      <ResetPasswordModal target={resetTarget} onClose={() => setResetTarget(null)} />
    </main>
  );
}
