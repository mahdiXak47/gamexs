"use client";

import { useLayoutEffect, useRef } from "react";

export default function GamePageScrollReset({ slug }: { slug: string }) {
  const previousSlug = useRef(slug);

  useLayoutEffect(() => {
    const slugChanged = previousSlug.current !== slug;
    previousSlug.current = slug;
    if (!slugChanged || window.location.hash) return;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [slug]);

  return null;
}
