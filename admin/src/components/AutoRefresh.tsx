"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "./Icon";

const INTERVAL_MS = 10_000;

/**
 * Re-renders the server page every 10 s (the scraper heartbeats every 10 s),
 * pauses while the tab is hidden, and can be paused by hand.
 */
export function AutoRefresh({ renderedAt }: { renderedAt: string }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (paused) return;
    const tick = () => {
      if (document.visibilityState === "visible") startTransition(() => router.refresh());
    };
    const timer = setInterval(tick, INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [paused, router]);

  return (
    <div className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
      <span className="tabular">
        {pending ? "Refreshing…" : `Updated ${new Date(renderedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Tehran", hour12: false })}`}
        {paused ? " · paused" : " · live"}
      </span>
      <Button size="sm" variant="ghost" isIconOnly aria-label={paused ? "Resume live updates" : "Pause live updates"} onPress={() => setPaused((p) => !p)}>
        <Icon name={paused ? "play" : "pause"} />
      </Button>
      <Button size="sm" variant="ghost" isIconOnly aria-label="Refresh now" isDisabled={pending} onPress={() => startTransition(() => router.refresh())}>
        <Icon name="refresh" className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}
