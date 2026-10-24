"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const DELAY_MS = 1800;

/** Progress bar + automatic hand-off to the seller; the manual link stays visible as a fallback. */
export function RedirectCountdown({ url, claim }: { url: string; claim: { id: string; token: string } | null }) {
  const [started, setStarted] = useState(false);
  const { user } = useAuth();
  // Attach the logged-in account to this click (admin click log). sendBeacon is
  // delivered even though the page navigates to the shop right after.
  useEffect(() => {
    if (!claim || !user) return;
    navigator.sendBeacon?.("/api/clicks", new Blob([JSON.stringify({ ...claim, userId: user.id })], { type: "application/json" }));
  }, [claim, user]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setStarted(true));
    const timer = setTimeout(() => window.location.replace(url), DELAY_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [url]);
  return (
    <div
      role="progressbar"
      aria-label="در حال انتقال به سایت فروشگاه"
      className="h-1.5 w-full overflow-hidden rounded-full bg-ps-blue-light"
    >
      <div
        className="h-full origin-right rounded-full bg-ps-blue transition-transform ease-out motion-reduce:transition-none"
        style={{ transform: `scaleX(${started ? 1 : 0})`, transitionDuration: `${DELAY_MS}ms` }}
      />
    </div>
  );
}
