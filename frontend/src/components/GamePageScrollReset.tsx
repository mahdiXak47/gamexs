"use client";

import { useLayoutEffect } from "react";

export default function GamePageScrollReset({ slug }: { slug: string }) {
  useLayoutEffect(() => {
    if (window.location.hash) return;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [slug]);

  return null;
}
