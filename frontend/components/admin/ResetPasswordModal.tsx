"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { isStrongPassword, strongPasswordMessage } from "@/lib/password";
import { resetAdminUserPassword, type AuthUser } from "@/lib/api";

type ResetPasswordModalProps = {
  target: AuthUser | null;
  onClose: () => void;
};

export default function ResetPasswordModal({ target, onClose }: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!target) return;
    setError("");
    if (!isStrongPassword(newPassword)) {
      setError(strongPasswordMessage);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await resetAdminUserPassword(target.id, newPassword);
      toast.success("Password reset successfully");
      setNewPassword("");
      setConfirmPassword("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={Boolean(target)} title={target ? `Reset password for ${target.name}` : "Reset password"} onClose={onClose}>
      <div className="mt-4 space-y-3">
        <input className="field" type="password" placeholder="New password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        <input className="field" type="password" placeholder="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">{strongPasswordMessage}</p>
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="btn-secondary" type="button" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn-primary" type="button" onClick={submit} disabled={loading}>{loading ? "Resetting..." : "Reset Password"}</button>
        </div>
      </div>
    </Modal>
  );
}
