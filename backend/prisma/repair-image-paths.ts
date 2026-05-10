import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function filenameFrom(value: string) {
  return path.basename(value.replace(/\\/g, "/"));
}

function isHttp(value: string) {
  return /^https?:\/\//i.test(value);
}

function normalizeCourtImagePath(value?: string | null) {
  if (!value) return value ?? null;
  const trimmed = value.trim();
  if (!trimmed || isHttp(trimmed)) return trimmed;
  const normalized = trimmed.replace(/\\/g, "/");
  if (normalized.startsWith("/uploads/courts/")) return normalized;
  if (normalized.startsWith("uploads/courts/")) return `/${normalized}`;
  return `/uploads/courts/${filenameFrom(normalized)}`;
}

function normalizeQrPath(value?: string | null) {
  if (!value) return value ?? null;
  const trimmed = value.trim();
  if (!trimmed || isHttp(trimmed)) return trimmed;
  const normalized = trimmed.replace(/\\/g, "/");
  if (normalized.startsWith("/uploads/qr/") || normalized.startsWith("/uploads/upi/")) return normalized;
  if (normalized.startsWith("uploads/qr/") || normalized.startsWith("uploads/upi/")) return `/${normalized}`;

  const filename = filenameFrom(normalized);
  const qrPath = path.join(process.cwd(), "uploads", "qr", filename);
  const legacyUpiPath = path.join(process.cwd(), "uploads", "upi", filename);
  if (fs.existsSync(legacyUpiPath) && !fs.existsSync(qrPath)) return `/uploads/upi/${filename}`;
  return `/uploads/qr/${filename}`;
}

async function main() {
  let changedCourts = 0;
  let changedImages = 0;

  const courts = await prisma.court.findMany({ select: { id: true, imageUrl: true, upiQrImageUrl: true } });
  for (const court of courts) {
    const imageUrl = normalizeCourtImagePath(court.imageUrl);
    const upiQrImageUrl = normalizeQrPath(court.upiQrImageUrl);
    const updates: { imageUrl?: string | null; upiQrImageUrl?: string | null } = {};
    if (imageUrl !== court.imageUrl) updates.imageUrl = imageUrl;
    if (upiQrImageUrl !== court.upiQrImageUrl) updates.upiQrImageUrl = upiQrImageUrl;
    if (Object.keys(updates).length > 0) {
      await prisma.court.update({ where: { id: court.id }, data: updates });
      changedCourts += 1;
      console.log(`Court ${court.id}:`, updates);
    }
  }

  const images = await prisma.courtImage.findMany({ select: { id: true, imageUrl: true } });
  for (const image of images) {
    const imageUrl = normalizeCourtImagePath(image.imageUrl);
    if (imageUrl && imageUrl !== image.imageUrl) {
      await prisma.courtImage.update({ where: { id: image.id }, data: { imageUrl } });
      changedImages += 1;
      console.log(`CourtImage ${image.id}: ${image.imageUrl} -> ${imageUrl}`);
    }
  }

  console.log(`Repair complete. Courts changed: ${changedCourts}. Court images changed: ${changedImages}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
