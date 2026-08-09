"use client";

import { useEffect, useRef } from "react";

export default function GameViewTracker({ slug }: { slug: string }) {
  const fired = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const track = () => {
      if (fired.current || document.visibilityState !== "visible") return;
      fired.current = true;
      fetch(`/api/games/${encodeURIComponent(slug)}/view`, {
        method: "POST",
        cache: "no-store",
        keepalive: true,
        signal: controller.signal,
      }).catch(() => {
        // View tracking is diagnostic and must never affect browsing.
      });
    };

    const schedule = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(track, 3000);
    };

    if (document.visibilityState === "visible") {
      schedule();
    } else {
      document.addEventListener("visibilitychange", schedule, { once: true });
    }

    return () => {
      if (timeout) clearTimeout(timeout);
      document.removeEventListener("visibilitychange", schedule);
      controller.abort();
    };
  }, [slug]);

  return null;
}
