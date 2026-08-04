"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Chip } from "@heroui/react";
import { formatToman } from "@/lib/format";
import type { GameSummary } from "@/lib/types";

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReduced(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function ChevronLeft({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export default function HeroBanner({ games }: { games: GameSummary[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();

  const next = useCallback(() => setCurrent((i) => (i + 1) % games.length), [games.length]);
  const prev = useCallback(() => setCurrent((i) => (i - 1 + games.length) % games.length), [games.length]);

  // Manual navigation pauses auto-advance for 6s then resumes
  const goTo = useCallback((i: number) => {
    setCurrent(i);
    setPaused(true);
    setTimeout(() => setPaused(false), 6000);
  }, []);

  const handlePrev = useCallback(() => {
    prev();
    setPaused(true);
    setTimeout(() => setPaused(false), 6000);
  }, [prev]);

  const handleNext = useCallback(() => {
    next();
    setPaused(true);
    setTimeout(() => setPaused(false), 6000);
  }, [next]);

  // Auto-advance — stopped when paused, user prefers reduced motion, or only 1 slide
  useEffect(() => {
    if (paused || games.length <= 1 || reducedMotion) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [paused, next, games.length, reducedMotion]);

  if (games.length === 0) return null;
  const game = games[current];

  return (
    <>
    <section
      className="relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      aria-label="بازی‌های ویژه"
      aria-roledescription="carousel"
    >
      {/* Blurred background */}
      <div className="absolute inset-0">
        {game.coverUrl ? (
          <Image
            src={game.coverUrl}
            alt=""
            fill
            className="object-cover object-center scale-110 blur-md brightness-[0.6]"
            priority
            unoptimized
          />
        ) : (
          <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #1a3a7a 0%, #0a1f4d 100%)" }} />
        )}
        {/* Gradient: transparent left (cover side) → darker right (info side) */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.72) 100%)" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      </div>

      {/* Two-column layout — dir="ltr" so left/right are always physical */}
      <div className="relative z-10 flex min-h-[62svh] sm:min-h-[70vh]" dir="ltr">

        {/* LEFT: Large cover art filling the left column */}
        <div className="hidden md:block relative w-[42%] shrink-0" aria-hidden>
          {game.coverUrl ? (
            <Image
              src={game.coverUrl}
              alt=""
              fill
              className="object-contain object-bottom drop-shadow-2xl"
              style={{ paddingTop: "48px", paddingLeft: "64px", paddingRight: "16px" }}
              priority
              unoptimized
            />
          ) : (
            <div className="absolute bottom-0 left-16 right-4 top-12 flex items-end justify-center">
              <div className="aspect-[3/4] w-full max-w-xs bg-white/10 rounded-2xl ring-1 ring-white/20 flex items-center justify-center text-5xl font-bold text-white">
                {game.coverInitial}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Game info — crossfade on slide change via key */}
        <div
          key={current}
          className="flex-1 flex flex-col justify-end px-5 pb-14 sm:px-8 sm:pb-20 md:px-12 lg:px-16 hero-content-enter"
          dir="rtl"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="max-w-md text-white">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Chip size="sm" className="bg-ps-blue text-white border-0 text-xs font-bold">PS5</Chip>
              {game.genreLabel && (
                <Chip size="sm" className="bg-white/25 text-white border-0 text-xs">{game.genreLabel}</Chip>
              )}
            </div>
            <h2 dir="auto" className="text-right text-2xl sm:text-4xl md:text-5xl font-extrabold leading-tight mb-3 drop-shadow-lg">
              {game.title}
            </h2>
            {game.publisher && (
              <p className="text-blue-200 text-sm mb-5">{game.publisher}</p>
            )}
            {game.lowestPriceToman !== null && (
              <div className="mb-6">
                <p className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-blue-200 text-sm">از</span>
                  <span className="price-figure font-extrabold text-2xl">{formatToman(game.lowestPriceToman)}</span>
                  <span className="text-blue-200 text-sm">تومان</span>
                </p>
                {game.lowestPriceLabel && (
                  <p className="mt-1 text-xs font-medium text-blue-100">
                    به شکل {game.lowestPriceLabel}
                  </p>
                )}
              </div>
            )}
            <Link
              href={`/games/${game.slug}`}
              className="inline-flex items-center gap-2 bg-white text-ps-blue font-bold px-7 py-3 rounded-full hover:bg-blue-50 transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              مشاهده قیمت‌ها
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile-visible controls */}
      {games.length > 1 && (
        <div className="absolute inset-x-4 top-1/2 z-20 flex -translate-y-1/2 justify-between md:hidden" dir="ltr">
          <button
            onClick={handlePrev}
            aria-label="بازی قبلی"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronLeft />
          </button>
          <button
            onClick={handleNext}
            aria-label="بازی بعدی"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronRight />
          </button>
        </div>
      )}

      {/* Segmented bar indicator + desktop prev/next click zones */}
      <button
        onClick={handlePrev}
        aria-label="بازی قبلی"
        className="absolute right-0 top-0 bottom-0 z-20 hidden w-16 cursor-pointer focus-visible:outline-none md:block"
      />
      <button
        onClick={handleNext}
        aria-label="بازی بعدی"
        className="absolute left-0 top-0 bottom-0 z-20 hidden w-16 cursor-pointer focus-visible:outline-none md:block"
      />

    </section>

    {/* Segmented bar indicator — sits on the light page background below the banner */}
    <div className="flex gap-2 mt-1 mb-2" role="tablist" aria-label="انتخاب بازی ویژه">
      {games.map((g, i) => (
        <button
          key={i}
          role="tab"
          aria-selected={i === current}
          aria-label={g.title}
          onClick={() => goTo(i)}
          className="cursor-pointer flex-1 h-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ps-blue)]"
        >
          <span
            className={`block w-full h-full transition-colors duration-300 ${
              i === current ? "bg-[var(--color-ps-blue)]" : "bg-gray-400 hover:bg-gray-500"
            }`}
          />
        </button>
      ))}
    </div>
    </>
  );
}
