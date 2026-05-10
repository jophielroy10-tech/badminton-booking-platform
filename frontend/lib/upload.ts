const allowedImageExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif", "heic", "heif"]);

export const imageAccept = "image/*,.heic,.heif,.avif,.webp,.bmp";

function extensionOf(file: File) {
  return file.name.split(".").pop()?.toLowerCase() || "";
}

export function validateImageFile(file: File, kind: "court" | "qr"): string | null {
  if (!allowedImageExtensions.has(extensionOf(file))) return "Please upload a valid image file.";
  if (!file.type.startsWith("image/") && !["heic", "heif"].includes(extensionOf(file))) return "Please upload a valid image file.";
  const maxBytes = kind === "qr" ? 3 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxBytes) return kind === "qr" ? "QR image size must be below 3 MB." : "Image size must be below 5 MB.";
  return null;
}

export function validateImageFiles(files: File[], kind: "court" | "qr") {
  for (const file of files) {
    const error = validateImageFile(file, kind);
    if (error) return error;
  }
  return null;
}
