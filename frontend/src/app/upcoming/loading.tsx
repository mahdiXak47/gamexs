import { Skeleton } from "@heroui/react";
import Header from "@/components/Header";

function UpcomingCardSkeleton({ delay }: { delay: number }) {
  return (
    <div
      className="loading-stagger-item loading-surface min-h-[220px] rounded-2xl border border-gray-200 bg-white shadow-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Skeleton className="h-full min-h-[220px] rounded-2xl" />
    </div>
  );
}

export default function UpcomingLoading() {
  return (
    <>
      <Header />
      <main className="page-loading-shell flex-1">
        <section className="bg-[#07101f]">
          <div className="mx-auto flex min-h-[72dvh] max-w-7xl flex-col justify-end px-4 pb-8 pt-20 sm:px-6">
            <div className="loading-stagger-item max-w-xl">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="mt-5 h-12 w-full max-w-lg rounded" />
              <Skeleton className="mt-3 h-12 w-3/4 rounded" />
              <Skeleton className="mt-6 h-12 w-36 rounded-lg" />
            </div>
            <div className="mt-8 grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, index) => (
                <Skeleton key={index} className="aspect-[4/5] rounded-lg" />
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6" dir="rtl">
          <div className="loading-stagger-item">
            <Skeleton className="h-4 w-40 rounded" />
            <div className="mt-5 flex items-center gap-3">
              <Skeleton className="h-9 w-48 rounded" />
              <Skeleton className="h-7 w-12 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-4 w-96 max-w-full rounded" />
          </div>

          <div className="mt-10 space-y-10">
            {[...Array(2)].map((_, groupIndex) => (
              <div key={groupIndex}>
                <div className="mb-4 flex items-center gap-3">
                  <Skeleton className="h-7 w-28 rounded" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-px flex-1 rounded" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[...Array(3)].map((_, index) => (
                    <UpcomingCardSkeleton key={index} delay={120 + groupIndex * 80 + index * 32} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
