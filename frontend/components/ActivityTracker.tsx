"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getToken, recordWebsiteEntered } from "@/lib/api";

export default function ActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!getToken()) return;
    if (sessionStorage.getItem("activity_enter_logged") === "true") return;

    sessionStorage.setItem("activity_enter_logged", "true");
    recordWebsiteEntered(pathname).catch(() => {
      sessionStorage.removeItem("activity_enter_logged");
    });
  }, [pathname]);

  return null;
}
