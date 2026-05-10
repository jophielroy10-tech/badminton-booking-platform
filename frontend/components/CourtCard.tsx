"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { Court } from "@/lib/api";
import { getImageUrl } from "@/lib/image";
import ImageWithFallback from "@/components/ui/ImageWithFallback";

type CourtCardProps = {
  court: Court;
};

export default function CourtCard({ court }: CourtCardProps) {
  const rawImage =
    court?.images?.find((img) => img?.isPrimary)?.imageUrl ||
    court?.images?.[0]?.imageUrl ||
    court?.imageUrl ||
    null;
  const imageSrc = getImageUrl(rawImage);

  if (process.env.NODE_ENV === "development") {
    console.log("COURT_CARD_NAME", court.name);
    console.log("COURT_CARD_IMAGES", court.images);
    console.log("COURT_CARD_IMAGE_URL", imageSrc);
  }

  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="relative aspect-video w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
        {imageSrc ? (
          <ImageWithFallback
            src={imageSrc}
            alt={court.name}
            className="h-full w-full object-cover"
            fallbackText="No image uploaded"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-medium text-slate-500 dark:text-slate-400">
            No image uploaded
          </div>
        )}
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="break-words text-lg font-bold text-slate-950 dark:text-white">{court.name}</h2>
          <span className="w-fit rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
            Available
          </span>
        </div>

        <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
          {court.description || "No description available"}
        </p>

        <p className="flex min-w-0 items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{court.area ? `${court.area}, ` : ""}{court.city || court.address || "Location not added"}</span>
        </p>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-bold text-slate-950 dark:text-white">Rs. {court.pricePerHour}/hr</p>
          <Link
            href={`/courts/${court.slug || court.id}`}
            className="btn-secondary w-full sm:w-auto"
          >
            View
          </Link>
        </div>
      </div>
    </article>
  );
}
