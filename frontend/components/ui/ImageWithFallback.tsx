"use client";

import { useEffect, useState } from "react";
import { getImageUrl } from "@/lib/image";

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  placeholder?: string;
  fallbackText?: string;
  sizes?: string;
  contain?: boolean;
};

export default function ImageWithFallback({ src, alt, className = "", placeholder, fallbackText, sizes = "100vw", contain = false }: Props) {
  const [failed, setFailed] = useState(false);
  const imageUrl = getImageUrl(src);
  const fallback = fallbackText ?? placeholder ?? "No image uploaded";
  const imageClassName = className || `h-full w-full ${contain ? "object-contain p-2" : "object-cover"}`;

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  if (!imageUrl || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-200 p-4 text-center text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      loading="lazy"
      sizes={sizes}
      className={imageClassName}
      onError={() => setFailed(true)}
    />
  );
}
