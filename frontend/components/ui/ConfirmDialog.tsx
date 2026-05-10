"use client";

import Modal from "./Modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
};

export default function ConfirmDialog({ open, title, description, confirmText, cancelText = "Cancel", onConfirm, onCancel, loading = false }: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button className="btn-secondary min-h-11" onClick={onCancel} disabled={loading}>{cancelText}</button>
        <button className="inline-flex min-h-11 items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300" onClick={onConfirm} disabled={loading}>
          {loading ? "Deleting..." : confirmText}
        </button>
      </div>
    </Modal>
  );
}
