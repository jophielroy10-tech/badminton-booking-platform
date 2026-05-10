import fs from "node:fs";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import sharp from "sharp";
import { cloudinary, isCloudinaryConfigured } from "../config/cloudinary.js";
import { AppError } from "./error.middleware.js";

const courtUploadRoot = path.resolve(process.cwd(), "uploads", "courts");
const qrUploadRoot = path.resolve(process.cwd(), "uploads", "qr");
const legacyUpiUploadRoot = path.resolve(process.cwd(), "uploads", "upi");
fs.mkdirSync(courtUploadRoot, { recursive: true });
fs.mkdirSync(qrUploadRoot, { recursive: true });
fs.mkdirSync(legacyUpiUploadRoot, { recursive: true });

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
  "image/heic",
  "image/heif"
]);

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif", ".heic", ".heif"]);
const conversionExtensions = new Set([".bmp", ".heic", ".heif"]);
const courtImageMaxBytes = 5 * 1024 * 1024;
const qrImageMaxBytes = 3 * 1024 * 1024;

function isQrField(fieldname: string) {
  return ["upiQrImage", "qrImage", "platformQrImage"].includes(fieldname);
}

const localStorage = multer.diskStorage({
  destination: (_req, file, cb) => cb(null, isQrField(file.fieldname) ? qrUploadRoot : courtUploadRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req: Request, file: Express.Multer.File) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
    return {
      folder: isQrField(file.fieldname) ? "badminton/qr" : "badminton/courts",
      resource_type: "image",
      allowed_formats: Array.from(allowedExtensions).map((value) => value.replace(".", "")),
      format: conversionExtensions.has(`.${ext}`) ? (isQrField(file.fieldname) ? "png" : "webp") : undefined,
      public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    };
  }
} as any);

const storage = isCloudinaryConfigured ? cloudinaryStorage : localStorage;

if (process.env.NODE_ENV !== "production") {
  console.log(isCloudinaryConfigured ? "Cloudinary upload storage enabled" : "Local upload storage enabled");
}

function imageFileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(ext)) {
    cb(new AppError("Only image files are allowed.", 400));
    return;
  }

  cb(null, true);
}

function flattenUploadedFiles(req: Request) {
  if (!req.files) return req.file ? [req.file] : [];
  if (Array.isArray(req.files)) return req.files;
  return Object.values(req.files).flat();
}

function replaceExtension(filename: string, ext: string) {
  return `${filename.slice(0, -path.extname(filename).length)}${ext}`;
}

async function convertUploadedFile(file: Express.Multer.File) {
  if (!file.path || /^https?:\/\//i.test(file.path)) return;
  const ext = path.extname(file.filename).toLowerCase();
  if (!conversionExtensions.has(ext)) return;

  const nextExt = isQrField(file.fieldname) ? ".png" : ".webp";
  const nextFilename = replaceExtension(file.filename, nextExt);
  const nextPath = path.join(path.dirname(file.path), nextFilename);

  try {
    const pipeline = sharp(file.path).rotate();
    if (isQrField(file.fieldname)) {
      await pipeline.resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 6 }).toFile(nextPath);
      file.mimetype = "image/png";
    } else {
      await pipeline.resize({ width: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toFile(nextPath);
      file.mimetype = "image/webp";
    }
  } catch {
    fs.rmSync(file.path, { force: true });
    throw new AppError("HEIC images are not supported by this server. Please upload JPG, PNG, or WEBP.", 400);
  }

  fs.rmSync(file.path, { force: true });
  file.filename = nextFilename;
  file.path = nextPath;
  file.destination = path.dirname(nextPath);
  file.size = fs.statSync(nextPath).size;
}

export async function processUploadedImages(req: Request, _res: Response, next: NextFunction) {
  try {
    for (const file of flattenUploadedFiles(req)) {
      const maxBytes = isQrField(file.fieldname) ? qrImageMaxBytes : courtImageMaxBytes;
      if (file.size && file.size > maxBytes) {
        fs.rmSync(file.path, { force: true });
        throw new AppError(isQrField(file.fieldname) ? "QR image size must be below 3 MB." : "Image size must be below 5 MB.", 400);
      }
      await convertUploadedFile(file);
      if (file.size && file.size > maxBytes) {
        fs.rmSync(file.path, { force: true });
        throw new AppError(isQrField(file.fieldname) ? "QR image size must be below 3 MB." : "Image size must be below 5 MB.", 400);
      }
      if (process.env.NODE_ENV !== "production") {
        const savedUrl = getUploadedFileUrl(file, isQrField(file.fieldname) ? "qr" : "court");
        console.log("[upload]", {
          originalName: file.originalname,
          savedUrlType: savedUrl?.startsWith("http://") || savedUrl?.startsWith("https://") || savedUrl?.includes("res.cloudinary.com") ? "CLOUDINARY" : "LOCAL",
          savedUrl
        });
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}

export const courtImageUpload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: courtImageMaxBytes }
});

export function getUploadedFileUrl(file: Express.Multer.File | undefined, type: "court" | "qr") {
  if (!file) return null;
  if (file.path && /^https?:\/\//i.test(file.path)) return file.path;
  if (file.path?.includes("res.cloudinary.com")) return file.path;
  if (file.filename) return type === "qr" ? `/uploads/qr/${file.filename}` : `/uploads/courts/${file.filename}`;
  return null;
}

export const uploadedFileUrl = getUploadedFileUrl;
