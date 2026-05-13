import fs from "node:fs";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import type { UploadApiOptions } from "cloudinary";
import sharp from "sharp";
import { cloudinary, isCloudinaryConfigured } from "../config/cloudinary.js";
import { AppError } from "./error.middleware.js";

/**
 * Extended file type because Cloudinary storage can add remote URL fields.
 */
type UploadedImageFile = Express.Multer.File & {
  secure_url?: string;
  url?: string;
  filename?: string;
  path?: string;
  destination?: string;
};

/**
 * Local upload folders.
 * These are used only when Cloudinary env variables are missing.
 */
const courtUploadRoot = path.resolve(process.cwd(), "uploads", "courts");
const qrUploadRoot = path.resolve(process.cwd(), "uploads", "qr");
const legacyUpiUploadRoot = path.resolve(process.cwd(), "uploads", "upi");

fs.mkdirSync(courtUploadRoot, { recursive: true });
fs.mkdirSync(qrUploadRoot, { recursive: true });
fs.mkdirSync(legacyUpiUploadRoot, { recursive: true });

/**
 * Accepted image MIME types.
 */
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
  "image/heic",
  "image/heif"
]);

/**
 * Accepted image extensions.
 */
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

/**
 * These formats may not display correctly in every browser,
 * so local uploads are converted to PNG/WEBP where possible.
 */
const conversionExtensions = new Set([".bmp", ".heic", ".heif"]);

const courtImageMaxBytes = 5 * 1024 * 1024; // 5 MB
const qrImageMaxBytes = 3 * 1024 * 1024; // 3 MB

function isQrField(fieldname: string) {
  return ["upiQrImage", "qrImage", "platformQrImage"].includes(fieldname);
}

function isRemoteUrl(value?: string | null) {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function removeLocalFileIfExists(filePath?: string) {
  if (!filePath || isRemoteUrl(filePath)) return;

  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // Ignore cleanup errors.
  }
}

/**
 * Local disk storage fallback.
 */
const localStorage = multer.diskStorage({
  destination: (_req, file, cb) => {
    cb(null, isQrField(file.fieldname) ? qrUploadRoot : courtUploadRoot);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

/**
 * Cloudinary storage.
 * Used only when CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
 * and CLOUDINARY_API_SECRET exist.
 */
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req: Request, file: Express.Multer.File) => {
    const originalExt = path.extname(file.originalname || "").toLowerCase();

    const baseParams: UploadApiOptions = {
      folder: isQrField(file.fieldname) ? "badminton/qr" : "badminton/courts",
      resource_type: "image",
      allowed_formats: Array.from(allowedExtensions).map((value) =>
        value.replace(".", "")
      ),
      public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    };

    // Only convert problematic formats.
    // Do not send format: undefined to Cloudinary.
    if (conversionExtensions.has(originalExt)) {
      baseParams.format = isQrField(file.fieldname) ? "png" : "webp";
    }

    return baseParams;
  }
});

const storage = isCloudinaryConfigured ? cloudinaryStorage : localStorage;

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
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(ext)) {
    cb(
      new AppError(
        "Only JPG, PNG, WEBP, GIF, BMP, AVIF, HEIC or HEIF images are allowed.",
        400
      )
    );
    return;
  }

  cb(null, true);
}

function flattenUploadedFiles(req: Request): Express.Multer.File[] {
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
  const uploadedFile = file as UploadedImageFile;

  /**
   * Cloudinary uploads already return a remote URL in file.path.
   * Do not run Sharp or fs operations on remote URLs.
   */
  if (!uploadedFile.path || isRemoteUrl(uploadedFile.path)) return;

  /**
   * FIX:
   * uploadedFile.filename can be undefined in TypeScript,
   * so safely derive filename from file.path if filename is missing.
   */
  const currentFilename = uploadedFile.filename || path.basename(uploadedFile.path);

  if (!currentFilename) {
    throw new AppError("Uploaded image filename is missing.", 400);
  }

  const ext = path.extname(currentFilename).toLowerCase();

  if (!conversionExtensions.has(ext)) return;

  const nextExt = isQrField(file.fieldname) ? ".png" : ".webp";
  const nextFilename = replaceExtension(currentFilename, nextExt);
  const nextPath = path.join(path.dirname(uploadedFile.path), nextFilename);

  try {
    const pipeline = sharp(uploadedFile.path).rotate();

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
  } catch (error) {
    removeLocalFileIfExists(uploadedFile.path);

    console.error("IMAGE_CONVERSION_ERROR:", {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      message: error instanceof Error ? error.message : String(error)
    });

    throw new AppError(
      "This image format is not supported by the server. Please upload JPG, PNG, or WEBP.",
      400
    );
  }

  removeLocalFileIfExists(uploadedFile.path);

  uploadedFile.filename = nextFilename;
  uploadedFile.path = nextPath;
  uploadedFile.destination = path.dirname(nextPath);
  uploadedFile.size = fs.statSync(nextPath).size;
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
            : "Court image size must be below 5 MB.",
          400
        );
      }

      await convertUploadedFile(file);

      if (file.size && file.size > maxBytes) {
        removeLocalFileIfExists(file.path);

        throw new AppError(
          isQrField(file.fieldname)
            ? "QR image size must be below 3 MB."
            : "Court image size must be below 5 MB.",
          400
        );
      }

      const savedUrl = getUploadedFileUrl(
        file,
        isQrField(file.fieldname) ? "qr" : "court"
      );

      if (process.env.NODE_ENV === "development") {
        console.log("[upload]", {
          fieldname: file.fieldname,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          storageMode: isCloudinaryConfigured ? "cloudinary" : "local",
          path: file.path,
          filename: file.filename,
          savedUrl
        });
      }

      if (!savedUrl) {
        throw new AppError(
          isQrField(file.fieldname)
            ? "QR image upload failed. Please upload JPG, PNG, or WEBP."
            : "Court image upload failed. Please upload JPG, PNG, or WEBP.",
          400
        );
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Set multer limit to 5 MB.
 * QR-specific 3 MB validation is handled inside processUploadedImages.
 */
export const courtImageUpload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: courtImageMaxBytes
  }
});

export function getUploadedFileUrl(
  file: Express.Multer.File | undefined,
  type: "court" | "qr"
): string | null {
  if (!file) return null;

  const uploadedFile = file as UploadedImageFile;

  if (uploadedFile.path && isRemoteUrl(uploadedFile.path)) {
    return uploadedFile.path;
  }

  if (uploadedFile.secure_url && isRemoteUrl(uploadedFile.secure_url)) {
    return uploadedFile.secure_url;
  }

  if (uploadedFile.url && isRemoteUrl(uploadedFile.url)) {
    return uploadedFile.url;
  }

  if (uploadedFile.filename) {
    return type === "qr"
      ? `/uploads/qr/${uploadedFile.filename}`
      : `/uploads/courts/${uploadedFile.filename}`;
  }

  return null;
}

export const uploadedFileUrl = getUploadedFileUrl;