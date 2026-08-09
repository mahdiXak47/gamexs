"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reducedMotion = useReducedMotion();

  const next = useCallback(() => setCurrent((i) => (i + 1) % games.length), [games.length]);
  const prev = useCallback(() => setCurrent((i) => (i - 1 + games.length) % games.length), [games.length]);

  const pauseTemporarily = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    setPaused(true);
    resumeTimer.current = setTimeout(() => setPaused(false), 6000);
  }, []);

  // Manual navigation pauses auto-advance for 6s then resumes.
  const goTo = useCallback((i: number) => {
    setCurrent(i);
    pauseTemporarily();
  }, [pauseTemporarily]);

  const handlePrev = useCallback(() => {
    prev();
    pauseTemporarily();
  }, [pauseTemporarily, prev]);

  const handleNext = useCallback(() => {
    next();
    pauseTemporarily();
  }, [next, pauseTemporarily]);

  // Auto-advance — stopped when paused, user prefers reduced motion, or only 1 slide
  useEffect(() => {
    if (paused || games.length <= 1 || reducedMotion) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [paused, next, games.length, reducedMotion]);

  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  if (games.length === 0) return null;
  const game = games[current];
  const backgroundUrl = game.keyArtUrl ?? game.coverUrl;

  return (
    <section
      className="relative overflow-hidden bg-[#07101f] text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      aria-label="بازی‌های ویژه"
      aria-roledescription="carousel"
    >
      <div className="absolute inset-0" aria-hidden>
        {backgroundUrl ? (
          <Image
            key={backgroundUrl}
            src={backgroundUrl}
            alt=""
            fill
            sizes="100vw"
            className="hero-art-motion object-cover object-center opacity-80"
            priority
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_28%_30%,rgba(246,184,41,0.28),transparent_34%),linear-gradient(135deg,#07101f_0%,#003087_54%,#050712_100%)]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,18,0.2)_0%,rgba(3,7,18,0.58)_42%,rgba(3,7,18,0.9)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(3,7,18,0.96)_0%,rgba(3,7,18,0.42)_34%,rgba(3,7,18,0.12)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-96px)] max-w-7xl flex-col justify-end px-4 pb-5 pt-16 sm:min-h-[calc(100svh-104px)] sm:px-6 lg:min-h-[min(690px,calc(100svh-104px))]">
        <div
          key={current}
          className="hero-content-enter mb-8 max-w-xl sm:mb-10 lg:mb-12"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Chip size="sm" className="border-0 bg-ps-plus-gold text-xs font-extrabold text-gray-950">PS5</Chip>
            {game.genreLabel && (
              <Chip size="sm" className="border-0 bg-white/18 text-xs font-semibold text-white backdrop-blur-md">{game.genreLabel}</Chip>
            )}
            {game.storeCount > 0 && (
              <Chip size="sm" className="border-0 bg-white/12 text-xs font-semibold text-blue-50 backdrop-blur-md">
                {game.storeCount} فروشنده
              </Chip>
            )}
          </div>

          <h2 dir="auto" className="mb-4 text-right text-3xl font-black leading-tight drop-shadow-2xl sm:text-5xl lg:text-6xl">
            {game.title}
          </h2>

          <p className="mb-6 max-w-lg text-sm leading-7 text-blue-50/90 sm:text-base">
            قیمت این بازی را بین فروشندگان معتبر مقایسه کن و بهترین گزینه خرید را مستقیم از سایت فروشنده انتخاب کن.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href={`/games/${game.slug}`}
              className="inline-flex min-h-12 w-fit cursor-pointer items-center justify-center rounded-lg bg-ps-plus-gold px-7 py-3 text-sm font-extrabold text-gray-950 shadow-[0_14px_32px_rgba(246,184,41,0.24)] transition-colors hover:bg-[#ffd35a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              مشاهده قیمت‌ها
            </Link>

            {game.lowestPriceToman !== null && (
              <div className="min-w-0 border-r border-white/20 pr-4">
                <p className="flex flex-wrap items-baseline gap-1.5">
                  <span className="text-xs font-semibold text-blue-100/90">شروع از</span>
                  <span className="price-figure text-2xl font-black text-white sm:text-3xl">{formatToman(game.lowestPriceToman)}</span>
                  <span className="text-xs font-semibold text-blue-100/90">تومان</span>
                </p>
                {game.lowestPriceLabel && (
                  <p className="mt-1 text-xs font-semibold text-ps-plus-gold">
                    {game.lowestPriceLabel}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {games.length > 1 && (
          <div className="flex items-center gap-3" dir="ltr">
            <button
              onClick={handlePrev}
              aria-label="بازی قبلی"
              className="hidden h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md transition-colors hover:bg-white/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:flex"
            >
              <ChevronLeft />
            </button>

            <div
              className="hide-scrollbar grid min-w-0 flex-1 auto-cols-[112px] grid-flow-col gap-3 overflow-x-auto pb-1 sm:auto-cols-[132px] md:auto-cols-[148px]"
              role="tablist"
              aria-label="انتخاب بازی ویژه"
            >
              {games.map((g, i) => (
                <button
                  key={g.slug}
                  role="tab"
                  aria-selected={i === current}
                  aria-label={g.title}
                  onClick={() => goTo(i)}
                  className={`group relative aspect-[5/4] cursor-pointer overflow-hidden rounded-lg bg-white/10 text-right shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    i === current ? "ring-2 ring-white" : "ring-1 ring-white/12 hover:ring-white/60"
                  }`}
                >
                  {g.coverUrl ? (
                    <Image
                      src={g.coverUrl}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 112px, (max-width: 768px) 132px, 148px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-ps-blue text-xl font-black text-white">
                      {g.coverInitial}
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/86 to-transparent px-2 pb-2 pt-8">
                    <span dir="auto" className="block truncate text-xs font-bold text-white">
                      {g.title}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={handleNext}
              aria-label="بازی بعدی"
              className="hidden h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md transition-colors hover:bg-white/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:flex"
            >
              <ChevronRight />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
