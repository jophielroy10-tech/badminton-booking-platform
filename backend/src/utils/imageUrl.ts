import type { Request } from "express";
import path from "node:path";

function backendBaseUrl(req: Request) {
  return (process.env.BACKEND_PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

function filenameFrom(value: string) {
  return path.basename(value.replace(/\\/g, "/"));
}

function toPublicUploadUrl(req: Request, imagePath: string | null | undefined, fallbackFolder: "courts" | "qr"): string | null {
  const value = String(imagePath || "").trim();
  if (!value) return null;
  if (value.startsWith("https://res.cloudinary.com/")) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const normalized = value.replace(/\\/g, "/");
  const uploadIndex = normalized.indexOf("/uploads/");
  if (uploadIndex >= 0) return `${backendBaseUrl(req)}${normalized.slice(uploadIndex)}`;
  if (normalized.startsWith("/uploads/")) return `${backendBaseUrl(req)}${normalized}`;
  if (normalized.startsWith("uploads/")) return `${backendBaseUrl(req)}/${normalized}`;
  return `${backendBaseUrl(req)}/uploads/${fallbackFolder}/${filenameFrom(normalized)}`;
}

export function toPublicImageUrl(req: Request, imagePath?: string | null, type: "court" | "qr" = "court"): string | null {
  return toPublicUploadUrl(req, imagePath, type === "qr" ? "qr" : "courts");
}

export function toPublicQrImageUrl(req: Request, imagePath?: string | null): string | null {
  return toPublicImageUrl(req, imagePath, "qr");
}

export function normalizeImageRecord<T extends { imageUrl?: string | null }>(req: Request, image: T): T {
  return { ...image, imageUrl: toPublicImageUrl(req, image.imageUrl) } as T;
}

export function normalizeCourtImages<T extends { imageUrl?: string | null; upiQrImageUrl?: string | null; images?: Array<{ imageUrl?: string | null }> }>(
  req: Request,
  court: T
): T {
  const images = (court.images || []).map((image) => normalizeImageRecord(req, image));
  const primary = images[0]?.imageUrl || toPublicImageUrl(req, court.imageUrl);
  return {
    ...court,
    imageUrl: primary,
    upiQrImageUrl: toPublicQrImageUrl(req, court.upiQrImageUrl),
    images
  };
}
