"use client";

import { useRef } from "react";
import GameCard from "./GameCard";
import type { GameSummary } from "@/lib/types";

function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

const SCROLL_AMOUNT = 320;

// Other purchasable editions of THIS game (e.g. Standard vs. Phantom Edition)
// — distinct from SimilarGames (which finds OTHER games by genre/developer).
// Larger cards than SimilarGames since editions are rare (usually 2, rarely
// 3+) — sized so ~3 fit in view without scrolling; nav arrows only render
// when there's actually more than fits, so they almost never appear.
export default function GameVersions({ games }: { games: GameSummary[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  if (games.length === 0) return null;

  const scrollBy = (amount: number) => {
    scrollerRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <section className="mt-10" aria-label="دیگر نسخه‌های این بازی" dir="rtl">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-bold text-gray-900">دیگر نسخه‌های این بازی</h2>
          <div className="flex-1 h-px bg-gray-200" />

          {games.length > 2 && (
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollBy(SCROLL_AMOUNT)}
                className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-ps-blue hover:border-ps-blue/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue"
                aria-label="اسکرول به راست"
              >
                <ChevronRight />
              </button>
              <button
                type="button"
                onClick={() => scrollBy(-SCROLL_AMOUNT)}
                className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-ps-blue hover:border-ps-blue/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue"
                aria-label="اسکرول به چپ"
              >
                <ChevronLeft />
              </button>
            </div>
          )}
        </div>

        <div
          ref={scrollerRef}
          className="hide-scrollbar flex gap-4 overflow-x-auto pb-1 snap-x snap-mandatory"
        >
          {games.map((game) => (
            <div key={game.slug} className="shrink-0 w-60 sm:w-72 snap-start">
              <GameCard game={game} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
