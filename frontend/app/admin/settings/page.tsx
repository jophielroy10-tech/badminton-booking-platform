"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import BackButton from "@/components/ui/BackButton";
import { getAdminSettings, updateAdminSettings, updateAdminPaymentSettings, uploadAdminPaymentQr, type PlatformSettings } from "@/lib/api";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import { getImageUrl } from "@/lib/image";
import { imageAccept, validateImageFile } from "@/lib/upload";

export default function AdminSettingsPage() {
  const [form, setForm] = useState<Partial<PlatformSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [qrFile, setQrFile] = useState<File | null>(null);

  useEffect(() => {
    getAdminSettings().then((response) => setForm(response.data ?? {})).catch(() => toast.error("Unable to load settings")).finally(() => setLoading(false));
  }, []);

  async function save() {
    if (form.adminUpiId && !form.adminUpiId.includes("@")) {
      toast.error("UPI ID should contain @");
      return;
    }
    if (Number(form.penaltyCommissionPercent) < Number(form.commissionPercent)) {
      toast.error("Penalty commission must be greater than or equal to normal commission");
      return;
    }
    setSaving(true);
    try {
      const response = await updateAdminSettings(form);
      await updateAdminPaymentSettings({ platformUpiId: form.platformUpiId || "", platformAccountName: form.platformAccountName || "" });
      if (qrFile) await uploadAdminPaymentQr(qrFile);
      setForm(response.data ?? {});
      const refreshed = await getAdminSettings();
      setForm(refreshed.data ?? {});
      setQrFile(null);
      toast.success("Platform settings updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-shell max-w-3xl">
      <BackButton fallback="/admin/dashboard" />
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Admin Settings</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Configure platform UPI and owner commission policy.</p>
      {loading ? <p className="mt-6 surface-card">Loading settings...</p> : (
        <section className="mt-6 space-y-4 surface-card">
          <input className="field" placeholder="Admin UPI ID" value={form.adminUpiId ?? ""} onChange={(e) => setForm({ ...form, adminUpiId: e.target.value })} />
          <input className="field" placeholder="Admin UPI Name" value={form.adminUpiName ?? ""} onChange={(e) => setForm({ ...form, adminUpiName: e.target.value })} />
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Platform Payment UPI</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <input className="field" placeholder="Platform UPI ID" value={form.platformUpiId ?? ""} onChange={(e) => setForm({ ...form, platformUpiId: e.target.value })} />
              <input className="field" placeholder="Account name" value={form.platformAccountName ?? ""} onChange={(e) => setForm({ ...form, platformAccountName: e.target.value })} />
              <input
                className="field sm:col-span-2"
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
                  setQrFile(file);
                }}
              />
            </div>
            {form.platformQrImageUrl && (
              <div className="relative mt-4 h-48 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800">
                <ImageWithFallback src={getImageUrl(form.platformQrImageUrl)} alt="Platform QR" placeholder="No QR uploaded" contain />
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-semibold">Normal commission %
              <input className="field mt-2" type="number" min={0} max={100} value={form.commissionPercent ?? 15} onChange={(e) => setForm({ ...form, commissionPercent: Number(e.target.value) })} />
            </label>
            <label className="text-sm font-semibold">Penalty commission %
              <input className="field mt-2" type="number" min={0} max={100} value={form.penaltyCommissionPercent ?? 20} onChange={(e) => setForm({ ...form, penaltyCommissionPercent: Number(e.target.value) })} />
            </label>
            <label className="text-sm font-semibold">Due window days
              <input className="field mt-2" type="number" min={1} max={15} value={form.commissionDueWindowDays ?? 5} onChange={(e) => setForm({ ...form, commissionDueWindowDays: Number(e.target.value) })} />
            </label>
          </div>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Saving..." : "Save Settings"}</button>
        </section>
      )}
    </main>
  );
}
