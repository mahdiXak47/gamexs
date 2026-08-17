import { Skeleton } from "@heroui/react";
import Header from "@/components/Header";

function OptionSkeleton({ delay }: { delay: number }) {
  return (
    <div className="loading-stagger-item loading-surface rounded-2xl border border-gray-200 bg-white shadow-sm" style={{ animationDelay: `${delay}ms` }}>
      <div className="border-b border-gray-100 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-28 rounded" />
            <Skeleton className="h-3 w-52 rounded" />
          </div>
          <Skeleton className="h-7 w-24 rounded" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 p-5">
        <div className="space-y-2">
          <Skeleton className="h-3 w-14 rounded" />
          <Skeleton className="h-4 w-24 rounded" />
        </div>
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>
    </div>
  );
}

export default function PsPlusTierLoading() {
  return (
    <>
      <Header />
      <main className="page-loading-shell flex-1">
        <section className="ps-header">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6" dir="rtl">
            <Skeleton className="h-4 w-28 rounded" />
            <div className="mt-6 flex items-center gap-5">
              <Skeleton className="h-[106px] w-20 rounded-xl" />
              <div className="space-y-3">
                <Skeleton className="h-9 w-56 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-3" dir="rtl">
          <div className="lg:col-span-2">
            <Skeleton className="h-7 w-32 rounded" />
            <Skeleton className="mt-4 h-16 w-full rounded-xl" />
            <div className="mt-4 space-y-4">
              {[...Array(3)].map((_, index) => (
                <OptionSkeleton key={index} delay={80 + index * 40} />
              ))}
            </div>
          </div>
          <aside className="space-y-4">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </aside>
        </section>
      </main>
    </>
  );
}
