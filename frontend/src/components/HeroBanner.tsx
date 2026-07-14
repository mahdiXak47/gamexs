"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Chip } from "@heroui/react";
import { formatToman } from "@/lib/format";
import type { GameSummary } from "@/lib/types";

function ChevronIcon({ dir }: { dir: "right" | "left" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {dir === "right" ? <path d="m9 18 6-6-6-6" /> : <path d="m15 18-6-6 6-6" />}
    </svg>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
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
    <section
      className="relative overflow-hidden"
      style={{ minHeight: "70vh" }}
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
      <div className="relative z-10 flex min-h-[70vh]" dir="ltr">

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
          className="flex-1 flex flex-col justify-end pb-20 px-8 md:px-12 lg:px-16 hero-content-enter"
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
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight mb-3 drop-shadow-lg">
              {game.title}
            </h2>
            {game.publisher && (
              <p className="text-blue-200 text-sm mb-5">{game.publisher}</p>
            )}
            {game.lowestPriceToman !== null && (
              <p className="mb-6 flex items-baseline gap-1.5 flex-wrap">
                <span className="text-blue-200 text-sm">از</span>
                <span className="price-figure font-extrabold text-2xl">{formatToman(game.lowestPriceToman)}</span>
                <span className="text-blue-200 text-sm">تومان</span>
              </p>
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

      {/* Carousel controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1" role="group" aria-label="کنترل کاروسل">
        {/* Prev */}
        <button
          onClick={handlePrev}
          aria-label="بازی قبلی"
          className="cursor-pointer flex items-center justify-center w-11 h-11 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronIcon dir="right" />
        </button>

        {/* Dot indicators — 44px hit area each */}
        <div className="flex items-center" role="tablist" aria-label="انتخاب بازی ویژه">
          {games.map((g, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === current}
              aria-label={g.title}
              onClick={() => goTo(i)}
              className="cursor-pointer flex items-center justify-center w-11 h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-full"
            >
              <span
                className={`block rounded-full transition-all duration-200 ${
                  i === current ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/40 hover:bg-white/65"
                }`}
              />
            </button>
          ))}
        </div>

        {/* Next */}
        <button
          onClick={handleNext}
          aria-label="بازی بعدی"
          className="cursor-pointer flex items-center justify-center w-11 h-11 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronIcon dir="left" />
        </button>
      </div>

      {/* Slide counter */}
      <div className="absolute top-4 right-4 z-20 text-white/50 text-xs tabular-nums" dir="ltr" aria-hidden>
        {current + 1} / {games.length}
      </div>
    </section>
  );
}
