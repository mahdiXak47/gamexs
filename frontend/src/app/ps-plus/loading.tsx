import { Skeleton } from "@heroui/react";
import Header from "@/components/Header";

function PlanSkeleton({ delay }: { delay: number }) {
  return (
    <div className="loading-stagger-item loading-surface rounded-2xl border border-gray-200 bg-white shadow-sm" style={{ animationDelay: `${delay}ms` }}>
      <Skeleton className="h-32 w-full rounded-t-2xl" />
      <div className="space-y-4 p-6">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-3 w-40 rounded" />
            </div>
            <Skeleton className="h-5 w-20 rounded" />
          </div>
        ))}
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function PsPlusLoading() {
  return (
    <>
      <Header />
      <main className="page-loading-shell flex-1">
        <section className="ps-header">
          <div className="mx-auto max-w-7xl px-4 py-10 text-center sm:px-6">
            <div className="loading-stagger-item mx-auto flex max-w-sm flex-col items-center">
              <Skeleton className="h-4 w-36 rounded" />
              <Skeleton className="mt-5 h-10 w-44 rounded" />
              <Skeleton className="mt-3 h-4 w-full rounded" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6" dir="rtl">
          <div className="loading-stagger-item mb-5" style={{ animationDelay: "40ms" }}>
            <Skeleton className="h-7 w-40 rounded" />
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[...Array(3)].map((_, index) => (
              <PlanSkeleton key={index} delay={80 + index * 40} />
            ))}
          </div>

          <div className="loading-stagger-item mt-12 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" style={{ animationDelay: "220ms" }}>
            <Skeleton className="h-6 w-44 rounded" />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[...Array(3)].map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-xl" />
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
