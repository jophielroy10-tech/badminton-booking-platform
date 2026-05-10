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

const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".avif",
  ".heic",
  ".heif"
]);

const conversionExtensions = new Set([".bmp", ".heic", ".heif"]);

const courtImageMaxBytes = 5 * 1024 * 1024; // 5 MB
const qrImageMaxBytes = 3 * 1024 * 1024; // 3 MB

function isQrField(fieldname: string) {
  return ["upiQrImage", "qrImage", "platformQrImage"].includes(fieldname);
}

function isRemoteUrl(value?: string) {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function removeLocalFileIfExists(filePath?: string) {
  if (!filePath || isRemoteUrl(filePath)) return;

  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // Ignore cleanup errors because upload validation error is more important.
  }
}

const localStorage = multer.diskStorage({
  destination: (_req, file, cb) => {
    cb(null, isQrField(file.fieldname) ? qrUploadRoot : courtUploadRoot);
  },
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
      allowed_formats: Array.from(allowedExtensions).map((value) =>
        value.replace(".", "")
      ),
      format: conversionExtensions.has(`.${ext}`)
        ? isQrField(file.fieldname)
          ? "png"
          : "webp"
        : undefined,
      public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    };
  }
} as any);

const storage = isCloudinaryConfigured ? cloudinaryStorage : localStorage;

// Important: log this even in production so Render tells us whether Cloudinary is active.
console.log(
  isCloudinaryConfigured
    ? "Cloudinary upload storage enabled"
    : "Local upload storage enabled"
);

function imageFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(ext)) {
    cb(new AppError("Only image files are allowed.", 400));
    return;
  }

  cb(null, true);
}

function flattenUploadedFiles(req: Request) {
  if (!req.files) return req.file ? [req.file] : [];

  if (Array.isArray(req.files)) {
    return req.files;
  }

  return Object.values(req.files).flat();
}

function replaceExtension(filename: string, ext: string) {
  return `${filename.slice(0, -path.extname(filename).length)}${ext}`;
}

async function convertUploadedFile(file: Express.Multer.File) {
  // Cloudinary uploads already return a remote URL in file.path.
  // Do not run Sharp or fs operations on remote URLs.
  if (!file.path || isRemoteUrl(file.path)) return;

  const ext = path.extname(file.filename).toLowerCase();

  if (!conversionExtensions.has(ext)) return;

  const nextExt = isQrField(file.fieldname) ? ".png" : ".webp";
  const nextFilename = replaceExtension(file.filename, nextExt);
  const nextPath = path.join(path.dirname(file.path), nextFilename);

  try {
    const pipeline = sharp(file.path).rotate();

    if (isQrField(file.fieldname)) {
      await pipeline
        .resize({
          width: 1200,
          height: 1200,
          fit: "inside",
          withoutEnlargement: true
        })
        .png({ compressionLevel: 6 })
        .toFile(nextPath);

      file.mimetype = "image/png";
    } else {
      await pipeline
        .resize({
          width: 1600,
          fit: "inside",
          withoutEnlargement: true
        })
        .webp({ quality: 80 })
        .toFile(nextPath);

      file.mimetype = "image/webp";
    }
  } catch {
    removeLocalFileIfExists(file.path);
    throw new AppError(
      "HEIC images are not supported by this server. Please upload JPG, PNG, or WEBP.",
      400
    );
  }

  removeLocalFileIfExists(file.path);

  file.filename = nextFilename;
  file.path = nextPath;
  file.destination = path.dirname(nextPath);
  file.size = fs.statSync(nextPath).size;
}

export async function processUploadedImages(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    for (const file of flattenUploadedFiles(req)) {
      const maxBytes = isQrField(file.fieldname)
        ? qrImageMaxBytes
        : courtImageMaxBytes;

      if (file.size && file.size > maxBytes) {
        removeLocalFileIfExists(file.path);

        throw new AppError(
          isQrField(file.fieldname)
            ? "QR image size must be below 3 MB."
            : "Image size must be below 5 MB.",
          400
        );
      }

      await convertUploadedFile(file);

      if (file.size && file.size > maxBytes) {
        removeLocalFileIfExists(file.path);

        throw new AppError(
          isQrField(file.fieldname)
            ? "QR image size must be below 3 MB."
            : "Image size must be below 5 MB.",
          400
        );
      }

      const savedUrl = getUploadedFileUrl(
        file,
        isQrField(file.fieldname) ? "qr" : "court"
      );

      // Important production debug log for Render.
      console.log("[upload]", {
        fieldname: file.fieldname,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        storageMode: isCloudinaryConfigured ? "cloudinary" : "local",
        savedUrl
      });
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

export function getUploadedFileUrl(
  file: Express.Multer.File | undefined,
  type: "court" | "qr"
) {
  if (!file) return null;

  const uploadedFile = file as Express.Multer.File & {
    path?: string;
    secure_url?: string;
    url?: string;
    filename?: string;
  };

  // Cloudinary usually stores uploaded image URL in file.path.
  if (uploadedFile.path && isRemoteUrl(uploadedFile.path)) {
    return uploadedFile.path;
  }

  // Extra safety for different Cloudinary response formats.
  if (uploadedFile.secure_url && isRemoteUrl(uploadedFile.secure_url)) {
    return uploadedFile.secure_url;
  }

  if (uploadedFile.url && isRemoteUrl(uploadedFile.url)) {
    return uploadedFile.url;
  }

  // Local fallback for development.
  if (uploadedFile.filename) {
    return type === "qr"
      ? `/uploads/qr/${uploadedFile.filename}`
      : `/uploads/courts/${uploadedFile.filename}`;
  }

  return null;
}

export const uploadedFileUrl = getUploadedFileUrl;