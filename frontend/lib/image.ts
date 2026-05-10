const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export function getImageUrl(src?: string | null): string | null {
  if (!src) return null;

  const value = String(src).trim();
  if (!value) return null;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/uploads")) return `${API_URL}${value}`;
  if (value.startsWith("uploads")) return `${API_URL}/${value}`;

  if (value.includes("\\uploads\\courts\\")) {
    const filename = value.split("\\uploads\\courts\\").pop();
    return filename ? `${API_URL}/uploads/courts/${filename}` : null;
  }

  if (value.includes("\\uploads\\qr\\")) {
    const filename = value.split("\\uploads\\qr\\").pop();
    return filename ? `${API_URL}/uploads/qr/${filename}` : null;
  }

  return value;
}

export function getCourtPrimaryImage(court: any): string | null {
  return court?.images?.find((img: any) => img?.isPrimary)?.imageUrl || court?.images?.[0]?.imageUrl || court?.imageUrl || null;
}
