import { Skeleton } from "@heroui/react";
import Header from "@/components/Header";

function CatalogCardSkeleton({ delay }: { delay: number }) {
  return (
    <div
      className="loading-stagger-item loading-surface overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Skeleton className="aspect-[3/4] w-full" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-4/5 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
        <Skeleton className="h-6 w-3/5 rounded" />
      </div>
    </div>
  );
}

export default function CatalogRouteLoading({
  titleWidth = "w-64",
}: {
  titleWidth?: string;
}) {
  return (
    <>
      <Header />
      <main className="page-loading-shell flex-1">
        <section className="ps-header">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6" dir="rtl">
            <Skeleton className="h-4 w-36 rounded" />
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Skeleton className={`h-10 ${titleWidth} max-w-full rounded`} />
              <Skeleton className="h-7 w-14 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-4 w-full max-w-xl rounded" />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6" dir="rtl">
          <Skeleton className="h-11 w-full max-w-xl rounded-xl" />
          <div className="mt-4 flex flex-wrap gap-2">
            {[...Array(5)].map((_, index) => (
              <Skeleton key={index} className="h-9 w-24 rounded-full" />
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {[...Array(8)].map((_, index) => (
              <CatalogCardSkeleton key={index} delay={120 + index * 28} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
