"use client";

import { useMemo, useState } from "react";
import type { Slot } from "@/lib/api";

type SlotCalendarProps = {
  slots: Slot[];
  selectedSlotId?: string;
  onSelectSlot: (slot: Slot) => void;
  disabled?: boolean;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function slotLabel(status: Slot["status"]) {
  const labels = {
    AVAILABLE: "Available",
    HOLD: "Held",
    BOOKED: "Booked",
    BLOCKED: "Blocked"
  };
  return labels[status];
}

function slotBadgeClass(status: Slot["status"]) {
  const classes = {
    AVAILABLE: "bg-emerald-100 text-emerald-800",
    HOLD: "bg-amber-100 text-amber-800",
    BOOKED: "bg-blue-100 text-blue-800",
    BLOCKED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
  };
  return classes[status];
}

export default function SlotCalendar({ slots, selectedSlotId, onSelectSlot, disabled = false }: SlotCalendarProps) {
  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      return date;
    });
  }, []);
  const [activeDay, setActiveDay] = useState(days[0]);

  const slotsByDay = useMemo(() => {
    return days.map((day) => ({
      day,
      slots: slots
        .filter((slot) => sameDay(new Date(slot.startTime), day))
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    }));
  }, [days, slots]);

  const activeSlots = slotsByDay.find((group) => sameDay(group.day, activeDay))?.slots ?? [];

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((day, index) => (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => setActiveDay(day)}
            className={`min-w-[112px] rounded-lg border px-3 py-2 text-left text-sm ${
              sameDay(day, activeDay)
                ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            }`}
          >
            <span className="block font-semibold">{index === 0 ? "Today" : index === 1 ? "Tomorrow" : day.toLocaleDateString("en-IN", { weekday: "short" })}</span>
            <span className="text-xs">{day.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {activeSlots.map((slot) => {
          const isAvailable = slot.status === "AVAILABLE" && !disabled;
          const selected = slot.id === selectedSlotId;
          return (
            <button
              key={slot.id}
              type="button"
              disabled={!isAvailable}
              onClick={() => onSelectSlot(slot)}
              className={`min-h-[112px] rounded-lg border p-4 text-left transition ${
                selected
                  ? "border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100"
                  : "border-slate-200 bg-white text-slate-900 hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              } disabled:cursor-not-allowed disabled:opacity-55`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {new Date(slot.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    to {new Date(slot.endTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <span className={`rounded px-2 py-1 text-xs font-bold ${slotBadgeClass(slot.status)}`}>
                  {slotLabel(slot.status)}
                </span>
              </div>
              {!isAvailable && (
                <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {slot.status === "BOOKED" ? "Not Available" : slotLabel(slot.status)}
                </p>
              )}
              <p className="mt-4 text-sm font-semibold">Rs. {slot.price}</p>
            </button>
          );
        })}
      </div>

      {activeSlots.length === 0 && (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          No slots available
        </p>
      )}
    </div>
  );
}
