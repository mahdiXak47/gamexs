"use client";

import { Skeleton } from "@heroui/react";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Renders children only after hydration. HeroUI's Table (react-aria-components
 * collections) builds rows a different number of times on the server and the
 * client, so its generated cell ids never match and React throws away the
 * whole server tree. Tables render client-side instead; the data is still
 * fetched on the server and passed in as props.
 */
export function ClientOnly({ children, rows = 6 }: { children: React.ReactNode; rows?: number }) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  if (hydrated) return children;
  return (
    <div className="flex flex-col gap-2 p-3" aria-busy="true" aria-label="Loading table">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-lg" />
      ))}
    </div>
  );
}
