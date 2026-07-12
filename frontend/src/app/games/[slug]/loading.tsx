import { Skeleton } from "@heroui/react";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <Skeleton className="h-4 w-48 rounded" />

      <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-[1fr_320px]">
        <div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-12 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-10 w-3/4 rounded" />
          <Skeleton className="mt-1 h-10 w-1/2 rounded" />

          <div className="mt-6 grid grid-cols-2 gap-6 sm:max-w-sm">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-12 rounded" />
              <Skeleton className="h-5 w-28 rounded" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-5 w-16 rounded" />
            </div>
          </div>

          <Skeleton className="mt-6 h-24 w-full max-w-sm rounded-2xl" />
        </div>

        <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
      </div>

      <div className="mt-10">
        <Skeleton className="h-8 w-48 rounded" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
      </div>
    </main>
  );
}
