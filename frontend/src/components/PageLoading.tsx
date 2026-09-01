import Image from "next/image";

export default function PageLoading() {
  return (
    <main
      className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-page-bg"
      role="status"
      aria-live="polite"
      aria-label="در حال بارگذاری GameXS"
    >
      <div className="flex flex-col items-center gap-5">
        <div className="flex h-28 w-28 items-center justify-center">
          <Image src="/loader7.svg" alt="" width={76} height={76} className="h-19 w-19" priority />
        </div>
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ps-blue/10" aria-hidden>
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-ps-plus-gold" />
        </div>
        <span className="sr-only">در حال بارگذاری GameXS</span>
      </div>
    </main>
  );
}
