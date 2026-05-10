"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { getOwnerCourtById, updateOwnerCourt, type Court } from "@/lib/api";
import BackButton from "@/components/ui/BackButton";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import { Skeleton } from "@/components/ui/Skeleton";
import { getImageUrl } from "@/lib/image";
import { imageAccept, validateImageFile, validateImageFiles } from "@/lib/upload";
import { isValidIndianMobile, mobileValidationMessage, normalizeMobileInput } from "@/lib/mobile";

export default function EditOwnerCourtPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [court, setCourt] = useState<Court | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    address: "",
    contactMobile: "",
    city: "",
    area: "",
    pricePerHour: "",
    cancellationChargePercent: "10",
    upiId: "",
    mapUrl: "",
    openingTime: "09:00",
    closingTime: "21:00",
    defaultSlotDurationMinutes: 60,
    slotGenerationDays: 7,
    defaultScheduleEnabled: true,
    status: "ACTIVE"
  });
  const [courtImages, setCourtImages] = useState<File[]>([]);
  const [replacePrimaryImage, setReplacePrimaryImage] = useState(true);
  const [upiQrImage, setUpiQrImage] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedImagePreviews = useMemo(() => courtImages.map((file) => URL.createObjectURL(file)), [courtImages]);
  const upiQrPreview = useMemo(() => (upiQrImage ? URL.createObjectURL(upiQrImage) : getImageUrl(court?.upiQrImageUrl) || ""), [upiQrImage, court?.upiQrImageUrl]);

  useEffect(() => () => selectedImagePreviews.forEach((src) => URL.revokeObjectURL(src)), [selectedImagePreviews]);
  useEffect(() => {
    if (!upiQrImage || !upiQrPreview.startsWith("blob:")) return undefined;
    return () => URL.revokeObjectURL(upiQrPreview);
  }, [upiQrImage, upiQrPreview]);

  useEffect(() => {
    getOwnerCourtById(params.id)
      .then((response) => {
        const data = response.data ?? null;
        setCourt(data);
        setForm({
          name: data?.name ?? "",
          description: data?.description ?? "",
          address: data?.address ?? "",
          contactMobile: data?.contactMobile ?? "",
          city: data?.city ?? "",
          area: data?.area ?? "",
          pricePerHour: data?.pricePerHour ? String(data.pricePerHour) : "",
          cancellationChargePercent: data?.cancellationChargePercent !== undefined && data?.cancellationChargePercent !== null ? String(data.cancellationChargePercent) : "10",
          upiId: data?.upiId ?? "",
          mapUrl: data?.mapUrl ?? "",
          openingTime: data?.openingTime ?? "09:00",
          closingTime: data?.closingTime ?? "21:00",
          defaultSlotDurationMinutes: data?.defaultSlotDurationMinutes ?? 60,
          slotGenerationDays: data?.slotGenerationDays ?? 7,
          defaultScheduleEnabled: data?.defaultScheduleEnabled ?? true,
          status: data?.status ?? "ACTIVE"
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load court"));
  }, [params.id]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      if (!form.upiId.trim()) throw new Error("Owner UPI ID is required");
      if (!form.upiId.includes("@")) throw new Error("Valid owner UPI ID is required");
      if (!isValidIndianMobile(form.contactMobile)) throw new Error(mobileValidationMessage);
      const cancellationChargePercent = Number(form.cancellationChargePercent);
      if (!Number.isFinite(cancellationChargePercent) || cancellationChargePercent < 0 || cancellationChargePercent > 100) {
        throw new Error("Cancellation charge must be between 0 and 100.");
      }
      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("description", form.description);
      formData.append("address", form.address);
      formData.append("contactMobile", form.contactMobile);
      formData.append("city", form.city);
      formData.append("area", form.area);
      formData.append("pricePerHour", String(form.pricePerHour));
      formData.append("cancellationChargePercent", String(form.cancellationChargePercent));
      formData.append("upiId", form.upiId);
      formData.append("mapUrl", form.mapUrl);
      formData.append("openingTime", form.openingTime);
      formData.append("closingTime", form.closingTime);
      formData.append("defaultSlotDurationMinutes", String(form.defaultSlotDurationMinutes));
      formData.append("slotGenerationDays", String(form.slotGenerationDays));
      formData.append("defaultScheduleEnabled", String(form.defaultScheduleEnabled));
      formData.append("status", form.status);
      formData.append("replacePrimaryImage", String(replacePrimaryImage));
      courtImages.forEach((file) => formData.append("courtImages", file));
      if (upiQrImage) formData.append("qrImage", upiQrImage);
      await updateOwnerCourt(params.id, formData);
      const refreshed = await getOwnerCourtById(params.id);
      setCourt(refreshed.data ?? court);
      setCourtImages([]);
      setUpiQrImage(null);
      const successMessage = courtImages.length > 0 || upiQrImage ? "Court image uploaded successfully" : "Court updated successfully";
      setMessage(successMessage);
      toast.success(successMessage);
      router.refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Unable to update court";
      setError(text);
      toast.error(text);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-shell">
      <BackButton fallback="/owner/courts" />
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Edit Court</h1>
      {!court && !error && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">Loading court details...</p>
          <Skeleton className="h-48 w-full" />
        </div>
      )}
      {error && <p className="mt-4 rounded-md bg-red-50 p-4 text-red-700">{error}</p>}
      {court && (
        <form onSubmit={submit} className="mt-6 space-y-5 surface-card">
          <section className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Court name
              <input className="field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Price per hour
              <input className="field" type="number" min={0} value={form.pricePerHour} onChange={(event) => setForm({ ...form, pricePerHour: event.target.value })} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Cancellation Charge %
              <input className="field" type="number" min={0} max={100} value={form.cancellationChargePercent} onChange={(event) => setForm({ ...form, cancellationChargePercent: event.target.value })} />
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                This percentage will be deducted when a user cancels a booking.
              </span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                Example: If booking amount is Rs. 1000 and cancellation charge is 10%, user receives Rs. 900 refund.
              </span>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 md:col-span-2">
              Description
              <textarea className="field min-h-24" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 md:col-span-2">
              Address
              <input className="field" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Court Contact Mobile Number
              <input
                className="field"
                type="tel"
                placeholder="Enter court contact mobile number"
                value={form.contactMobile}
                onChange={(event) => setForm({ ...form, contactMobile: normalizeMobileInput(event.target.value).replace(/(?!^\+)\D/g, "") })}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              City
              <input className="field" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Area
              <input className="field" value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 md:col-span-2">
              Google Maps URL / Map URL
              <input className="field" value={form.mapUrl} onChange={(event) => setForm({ ...form, mapUrl: event.target.value })} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Status
              <select className="field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="PENDING_APPROVAL">Pending approval</option>
              </select>
            </label>
          </section>
          <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Court Images</h2>
            <input
              className="field mt-3"
              type="file"
              accept={imageAccept}
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []).slice(0, 10);
                const validationError = validateImageFiles(files, "court");
                if (validationError) {
                  toast.error(validationError);
                  event.currentTarget.value = "";
                  return;
                }
                setCourtImages(files);
              }}
            />
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={replacePrimaryImage} onChange={(event) => setReplacePrimaryImage(event.target.checked)} />
              Use first selected image as primary image
            </label>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {selectedImagePreviews.map((src, index) => (
                <div key={src} className="relative h-40 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                  <ImageWithFallback src={src} alt={`Selected court image ${index + 1}`} placeholder="Preview not available, but file can still be uploaded." />
                </div>
              ))}
              {court.images?.map((image) => (
                <div key={image.id} className="relative h-40 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                  <ImageWithFallback src={getImageUrl(image.imageUrl)} alt={`${court.name} image`} />
                  {image.isPrimary && <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">Primary</span>}
                </div>
              ))}
              {!selectedImagePreviews.length && !court.images?.length && (
                <div className="h-40 overflow-hidden rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                  <ImageWithFallback src={getImageUrl(court.imageUrl)} alt={court.name} />
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Schedule</h2>
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.defaultScheduleEnabled} onChange={(event) => setForm({ ...form, defaultScheduleEnabled: event.target.checked })} /> Generate default slots after approval</label>
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <input className="field" type="time" value={form.openingTime} onChange={(event) => setForm({ ...form, openingTime: event.target.value })} />
              <input className="field" type="time" value={form.closingTime} onChange={(event) => setForm({ ...form, closingTime: event.target.value })} />
              <select className="field" value={form.defaultSlotDurationMinutes} onChange={(event) => setForm({ ...form, defaultSlotDurationMinutes: Number(event.target.value) })}><option value={30}>30 min</option><option value={60}>60 min</option><option value={90}>90 min</option><option value={120}>120 min</option></select>
              <input className="field" type="number" min={1} max={30} value={form.slotGenerationDays} onChange={(event) => setForm({ ...form, slotGenerationDays: Number(event.target.value) })} />
            </div>
          </section>

          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Payment Receiving Details</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                Owner UPI ID
                <input className="field" placeholder="example@okaxis" value={form.upiId} onChange={(event) => setForm({ ...form, upiId: event.target.value })} />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                Owner UPI QR Code
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
            </div>
            {upiQrPreview && (
              <div className="mt-4 relative h-52 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800">
                <ImageWithFallback src={upiQrPreview} alt="UPI QR" contain placeholder={upiQrImage ? "Preview not available, but file can still be uploaded." : "No QR uploaded"} />
              </div>
            )}
          </section>

          <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
          {message && <p className="text-sm font-medium text-emerald-600">{message}</p>}
        </form>
      )}
    </main>
  );
}
