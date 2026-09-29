"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Ambil ulang data dari server secara berkala selama tab sedang dilihat. */
export function useAutoRefresh(intervalMs: number) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);
}
