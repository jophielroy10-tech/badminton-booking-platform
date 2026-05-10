"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createOwnerCourt } from "@/lib/api";
import BackButton from "@/components/ui/BackButton";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import { imageAccept, validateImageFile, validateImageFiles } from "@/lib/upload";
import { isValidIndianMobile, mobileValidationMessage, normalizeMobileInput } from "@/lib/mobile";

type CourtDraft = {
  name: string;
  description: string;
  city: string;
  area: string;
  address: string;
  contactMobile: string;
  mapUrl: string;
  type: "INDOOR" | "OUTDOOR";
  openingTime: string;
  closingTime: string;
  pricePerHour: string;
  cancellationChargePercent: string;
  hasAC: boolean;
  hasCoaching: boolean;
  upiId: string;
  defaultScheduleEnabled: boolean;
  defaultSlotDurationMinutes: number;
  slotGenerationDays: number;
  daysOpen: number[];
};

const blank = (): CourtDraft => ({
  name: "",
  description: "",
  city: "",
  area: "",
  address: "",
  contactMobile: "",
  mapUrl: "",
  type: "INDOOR",
  openingTime: "09:00",
  closingTime: "21:00",
  pricePerHour: "",
  cancellationChargePercent: "10",
  hasAC: false,
  hasCoaching: false,
  upiId: "",
  defaultScheduleEnabled: true,
  defaultSlotDurationMinutes: 60,
  slotGenerationDays: 7,
  daysOpen: [0, 1, 2, 3, 4, 5, 6]
});

const countOptions = [1, 2, 3, 4, 5, 10, 20];
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function NewOwnerCourtPage() {
  const router = useRouter();
  const [count, setCount] = useState(1);
  const [customCount, setCustomCount] = useState("");
  const [courts, setCourts] = useState<CourtDraft[]>([blank()]);
  const [images, setImages] = useState<File[][]>([[]]);
  const [qrImages, setQrImages] = useState<Array<File | null>>([null]);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState("");
  const firstPreview = useMemo(() => images.map((group) => group[0] ? URL.createObjectURL(group[0]) : ""), [images]);

  function resize(nextCount: number) {
    const safeCount = Math.max(1, Math.min(20, nextCount));
    setCount(safeCount);
    setCourts((current) => Array.from({ length: safeCount }, (_, index) => current[index] ?? blank()));
    setImages((current) => Array.from({ length: safeCount }, (_, index) => current[index] ?? []));
    setQrImages((current) => Array.from({ length: safeCount }, (_, index) => current[index] ?? null));
  }

  async function submit() {
    for (let index = 0; index < courts.length; index += 1) {
      const court = courts[index];
      if (!court.name || !court.description || !court.city || !court.area || !court.address || !court.pricePerHour || !court.upiId) {
        toast.error(`Court ${index + 1}: complete required fields`);
        return;
      }
      if (!court.upiId.includes("@")) {
        toast.error(`Court ${index + 1}: enter a valid UPI ID`);
        return;
      }
      if (!isValidIndianMobile(court.contactMobile)) {
        toast.error(`Court ${index + 1}: ${mobileValidationMessage}`);
        return;
      }
      const cancellationChargePercent = Number(court.cancellationChargePercent);
      if (!Number.isFinite(cancellationChargePercent) || cancellationChargePercent < 0 || cancellationChargePercent > 100) {
        toast.error("Cancellation charge must be between 0 and 100.");
        return;
      }
      if (images[index].length === 0) {
        toast.error("Please upload at least one court image.");
        return;
      }
      if (court.mapUrl && !/^https?:\/\/.+/i.test(court.mapUrl)) {
        toast.error(`Court ${index + 1}: enter a valid map URL`);
        return;
      }
    }

    setCreating(true);
    try {
      let created = 0;
      for (let index = 0; index < courts.length; index += 1) {
        setProgress(`Creating court ${index + 1} of ${courts.length}`);
        const formData = new FormData();
        const court = courts[index];
        Object.entries(court).forEach(([key, value]) => formData.append(key, Array.isArray(value) ? value.join(",") : String(value)));
        images[index].forEach((file) => formData.append("courtImages", file));
        if (qrImages[index]) formData.append("qrImage", qrImages[index] as File);
        await createOwnerCourt(formData);
        created += 1;
      }
      toast.success("Court image uploaded successfully");
      router.push("/owner/courts");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create courts");
    } finally {
      setCreating(false);
      setProgress("");
    }
  }

  return (
    <main className="page-shell">
      <BackButton fallback="/owner/courts" />
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Create Courts</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Create 1 to 20 courts. Each court can have its own price, UPI, images, map URL, and schedule.</p>

      <section className="mt-6 surface-card">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">How many courts do you have?</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {countOptions.map((value) => <button key={value} className={count === value ? "btn-primary" : "btn-secondary"} onClick={() => resize(value)}>{value}</button>)}
          <input className="field w-32" placeholder="Custom" type="number" min={1} max={20} value={customCount} onChange={(event) => { setCustomCount(event.target.value); resize(Number(event.target.value || 1)); }} />
        </div>
      </section>

      <div className="mt-6 grid gap-6">
        {courts.map((court, index) => (
          <section key={index} className="surface-card">
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Court {index + 1}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input value={court.name} placeholder="Court name" onChange={(value) => update(courts, setCourts, index, { name: value })} />
              <select className="field" value={court.type} onChange={(event) => update(courts, setCourts, index, { type: event.target.value as CourtDraft["type"] })}><option value="INDOOR">Indoor</option><option value="OUTDOOR">Outdoor</option></select>
              <Input value={court.city} placeholder="City" onChange={(value) => update(courts, setCourts, index, { city: value })} />
              <Input value={court.area} placeholder="Area" onChange={(value) => update(courts, setCourts, index, { area: value })} />
              <Input className="md:col-span-2" value={court.address} placeholder="Address" onChange={(value) => update(courts, setCourts, index, { address: value })} />
              <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                Court Contact Mobile Number
                <input
                  className="field"
                  type="tel"
                  placeholder="Enter court contact mobile number"
                  value={court.contactMobile}
                  onChange={(event) => update(courts, setCourts, index, { contactMobile: normalizeMobileInput(event.target.value).replace(/(?!^\+)\D/g, "") })}
                  required
                />
              </label>
              <Input className="md:col-span-2" value={court.mapUrl} placeholder="Google Maps URL / Map URL" onChange={(value) => update(courts, setCourts, index, { mapUrl: value })} />
              <Input type="number" value={court.pricePerHour} placeholder="Price per hour" onChange={(value) => update(courts, setCourts, index, { pricePerHour: value })} />
              <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                Cancellation Charge %
                <input
                  className="field"
                  type="number"
                  min={0}
                  max={100}
                  value={court.cancellationChargePercent}
                  onChange={(event) => update(courts, setCourts, index, { cancellationChargePercent: event.target.value })}
                />
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  This percentage will be deducted when a user cancels a booking.
                </span>
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  Example: If booking amount is Rs. 1000 and cancellation charge is 10%, user receives Rs. 900 refund.
                </span>
              </label>
              <Input value={court.upiId} placeholder="Court owner UPI ID" onChange={(value) => update(courts, setCourts, index, { upiId: value })} />
              <textarea className="field min-h-24 md:col-span-2" placeholder="Description" value={court.description} onChange={(event) => update(courts, setCourts, index, { description: event.target.value })} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={court.hasAC} onChange={(event) => update(courts, setCourts, index, { hasAC: event.target.checked })} /> AC</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={court.hasCoaching} onChange={(event) => update(courts, setCourts, index, { hasCoaching: event.target.checked })} /> Coaching</label>
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={court.defaultScheduleEnabled} onChange={(event) => update(courts, setCourts, index, { defaultScheduleEnabled: event.target.checked })} /> Use default schedule: 9 AM to 9 PM, 1-hour slots, all days</label>
              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <input className="field" type="time" value={court.openingTime} onChange={(event) => update(courts, setCourts, index, { openingTime: event.target.value })} />
                <input className="field" type="time" value={court.closingTime} onChange={(event) => update(courts, setCourts, index, { closingTime: event.target.value })} />
                <select className="field" value={court.defaultSlotDurationMinutes} onChange={(event) => update(courts, setCourts, index, { defaultSlotDurationMinutes: Number(event.target.value) })}><option value={30}>30 min</option><option value={60}>60 min</option><option value={90}>90 min</option><option value={120}>120 min</option></select>
                <input className="field" type="number" min={1} max={30} value={court.slotGenerationDays} onChange={(event) => update(courts, setCourts, index, { slotGenerationDays: Number(event.target.value) })} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {weekdays.map((day, dayOfWeek) => <button key={day} className={court.daysOpen.includes(dayOfWeek) ? "btn-primary px-3" : "btn-secondary px-3"} onClick={() => update(courts, setCourts, index, { daysOpen: court.daysOpen.includes(dayOfWeek) ? court.daysOpen.filter((item) => item !== dayOfWeek) : [...court.daysOpen, dayOfWeek] })}>{day}</button>)}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">Court images<input className="field" type="file" accept={imageAccept} multiple onChange={(event) => updateFiles(images, setImages, index, Array.from(event.target.files ?? []).slice(0, 10))} /></label>
              <label className="grid gap-2 text-sm font-medium">UPI QR image optional<input className="field" type="file" accept={imageAccept} onChange={(event) => updateQr(qrImages, setQrImages, index, event.target.files?.[0] ?? null)} /></label>
            </div>
            {firstPreview[index] && <div className="relative mt-4 aspect-video max-w-sm overflow-hidden rounded-lg border border-slate-200"><ImageWithFallback src={firstPreview[index]} alt="Court preview" placeholder="Preview not available, but file can still be uploaded." /></div>}
          </section>
        ))}
      </div>

      <div className="sticky bottom-0 mt-6 border-t border-slate-200 bg-white/95 py-4 dark:border-slate-800 dark:bg-slate-950/95">
        <button className="btn-primary min-h-11 w-full sm:w-auto" disabled={creating} onClick={submit}>{creating ? progress || "Creating..." : "Submit Courts for Admin Approval"}</button>
      </div>
    </main>
  );
}

function update(items: CourtDraft[], setItems: (items: CourtDraft[]) => void, index: number, patch: Partial<CourtDraft>) {
  setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
}

function updateFiles(items: File[][], setItems: (items: File[][]) => void, index: number, files: File[]) {
  const error = validateImageFiles(files, "court");
  if (error) {
    toast.error(error);
    return;
  }
  setItems(items.map((item, itemIndex) => itemIndex === index ? files : item));
}

function updateQr(items: Array<File | null>, setItems: (items: Array<File | null>) => void, index: number, file: File | null) {
  if (file) {
    const error = validateImageFile(file, "qr");
    if (error) {
      toast.error(error);
      return;
    }
  }
  setItems(items.map((item, itemIndex) => itemIndex === index ? file : item));
}

function Input({ value, placeholder, onChange, type = "text", className = "" }: { value: string; placeholder: string; onChange: (value: string) => void; type?: string; className?: string }) {
  return <input className={`field ${className}`} type={type} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />;
}
