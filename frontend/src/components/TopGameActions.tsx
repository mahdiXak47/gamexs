"use client";

import { useToast } from "@/context/ToastContext";
import WishlistButton from "./WishlistButton";

function BookmarkIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 4.75A2.75 2.75 0 0 1 8.75 2h6.5A2.75 2.75 0 0 1 18 4.75V22l-6-3.75L6 22V4.75Z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default function TopGameActions({ gameId }: { gameId: number }) {
  const toast = useToast();

  function explainComingSoon(label: string) {
    toast.info(`${label} به‌زودی`, "این قابلیت در حال آماده‌سازی است.");
  }

  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-3 z-20 flex translate-y-1 items-center justify-center gap-2 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
      <div className="pointer-events-auto">
        <WishlistButton gameId={gameId} variant="overlay" />
      </div>
      <button
        type="button"
        onClick={() => explainComingSoon("لیست تماشا")}
        className="pointer-events-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-sm transition hover:border-ps-plus-gold hover:bg-ps-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-plus-gold"
        aria-label="افزودن به لیست تماشا؛ به‌زودی"
        title="لیست تماشا؛ به‌زودی"
      >
        <BookmarkIcon />
      </button>
      <button
        type="button"
        onClick={() => explainComingSoon("یادآوری انتشار")}
        className="pointer-events-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-sm transition hover:border-ps-plus-gold hover:bg-ps-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-plus-gold"
        aria-label="دریافت یادآوری انتشار؛ به‌زودی"
        title="یادآوری انتشار؛ به‌زودی"
      >
        <BellIcon />
      </button>
    </div>
  );
}
