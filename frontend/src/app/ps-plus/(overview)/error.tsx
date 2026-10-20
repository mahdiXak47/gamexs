"use client";

import { useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";

export default function PsPlusError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("PS Plus route error", error);
  }, [error]);

  return (
    <>
      <Header />
      <main id="main-content" className="flex-1">
        <section className="ps-header text-white">
          <div className="mx-auto grid min-h-[calc(100dvh-360px)] max-w-7xl content-center gap-8 px-4 py-16 sm:px-6">
            <div className="max-w-2xl">
              <p className="mb-4 font-mono text-sm font-bold text-blue-100">500</p>
              <h1 className="text-3xl font-black leading-tight sm:text-5xl">
                قیمت‌های PS Plus موقتاً در دسترس نیست
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-8 text-blue-100 sm:text-base">
                خطا می‌تواند مربوط به دریافت قیمت‌ها باشد. دوباره تلاش کنید یا فعلاً به فهرست بازی‌ها برگردید.
              </p>
              {error.digest && (
                <p className="mt-4 font-mono text-xs text-blue-100/80" dir="ltr">
                  Error ID: {error.digest}
                </p>
              )}
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => unstable_retry()}
                  className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg bg-white px-5 text-sm font-bold text-ps-blue transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ps-blue"
                >
                  تلاش دوباره
                </button>
                <Link
                  href="/"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-white/40 px-5 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  بازگشت به بازی‌ها
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
