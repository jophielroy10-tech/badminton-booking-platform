import { PrismaClient } from "@prisma/client";

const allowedDurations = new Set([30, 60, 90, 120]);

function dateOnly(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function buildDateTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = dateOnly(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

export async function generateSlotsForCourtSchedule(
  tx: PrismaClient | any,
  court: { id: string; pricePerHour: number; openingTime?: string | null; closingTime?: string | null; defaultSlotDurationMinutes: number; slotGenerationDays: number },
) {
  const schedules = await tx.courtSchedule.findMany({ where: { courtId: court.id } });
  let createdCount = 0;
  let skippedCount = 0;
  const today = dateOnly(new Date());
  const days = Math.max(1, Math.min(court.slotGenerationDays || 7, 30));

  for (let index = 0; index < days; index += 1) {
    const current = new Date(today);
    current.setDate(today.getDate() + index);
    const schedule = schedules.find((item: any) => item.dayOfWeek === current.getDay());
    const isOpen = schedule ? schedule.isOpen : true;
    if (!isOpen) continue;
    const openingTime = schedule?.openingTime || court.openingTime || "09:00";
    const closingTime = schedule?.closingTime || court.closingTime || "21:00";
    const duration = schedule?.slotDurationMinutes || court.defaultSlotDurationMinutes || 60;
    if (!allowedDurations.has(duration) || openingTime >= closingTime) continue;

    let cursor = buildDateTime(current, openingTime);
    const close = buildDateTime(current, closingTime);
    while (cursor < close) {
      const endTime = new Date(cursor.getTime() + duration * 60 * 1000);
      if (endTime > close) break;
      const overlaps = await tx.slot.count({
        where: {
          courtId: court.id,
          startTime: { lt: endTime },
          endTime: { gt: cursor }
        }
      });
      if (overlaps > 0) {
        skippedCount += 1;
      } else {
        await tx.slot.create({
          data: {
            courtId: court.id,
            date: dateOnly(current),
            startTime: new Date(cursor),
            endTime,
            price: court.pricePerHour,
            status: "AVAILABLE"
          }
        });
        createdCount += 1;
      }
      cursor = endTime;
    }
  }

  return { createdCount, skippedCount };
}

export function defaultSchedules(input: { openingTime?: string | null; closingTime?: string | null; slotDurationMinutes?: number; daysOpen?: number[] }) {
  const daysOpen = input.daysOpen?.length ? input.daysOpen : [0, 1, 2, 3, 4, 5, 6];
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: daysOpen.includes(dayOfWeek),
    openingTime: input.openingTime || "09:00",
    closingTime: input.closingTime || "21:00",
    slotDurationMinutes: input.slotDurationMinutes && allowedDurations.has(input.slotDurationMinutes) ? input.slotDurationMinutes : 60
  }));
}
