import { Skeleton } from "@heroui/react";

function SkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <Skeleton className="aspect-[3/4] w-full" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-4 w-4/5 rounded" />
        <Skeleton className="h-3 w-2/5 rounded" />
        <Skeleton className="mt-1 h-6 w-3/5 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl flex-1 px-4 py-10 sm:px-6">
      <Skeleton className="h-10 w-72 rounded" />
      <Skeleton className="mt-3 h-4 w-96 rounded" />

      <div className="mt-6 h-10 w-full max-w-xl rounded-xl">
        <Skeleton className="h-full w-full rounded-xl" />
      </div>

      <div className="mt-4 flex justify-between">
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-4 w-32 rounded" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </main>
  );
}
