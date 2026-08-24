"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Anonymous, first-party pageview measurement. No cookie, fingerprint, IP, or
// query string is stored; the server only records the pathname and timestamp.
export default function PageViewReporter() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/api/")) return;
    const body = JSON.stringify({ path: pathname });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/pageview", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/pageview", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
  }, [pathname]);

  return null;
}
