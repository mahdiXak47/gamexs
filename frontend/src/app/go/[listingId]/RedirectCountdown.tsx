"use client";

import { useEffect, useState } from "react";

const DELAY_MS = 1800;

/** Progress bar + automatic hand-off to the seller; the manual link stays visible as a fallback. */
export function RedirectCountdown({ url }: { url: string }) {
  const [started, setStarted] = useState(false);
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
