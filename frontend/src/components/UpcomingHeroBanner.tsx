"use client";

import { useEffect, useState, useCallback, useReducer } from "react";
import Link from "next/link";
import Image from "next/image";
import { Chip } from "@heroui/react";
import { formatToman, toPersianDigits } from "@/lib/format";
import type { UpcomingGame } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function formatPersianDate(isoDate: string): string {
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(isoDate));
}

function computeRemaining(isoDate: string) {
  const diff = Math.max(0, new Date(isoDate).getTime() - Date.now());
  const totalSec = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
  };
}

// ── Countdown (inline, no separate import needed) ────────────────────────────

function HeroCountdown({ releaseDate }: { releaseDate: string }) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const { days, hours, minutes } = computeRemaining(releaseDate);

  function Unit({ value, label }: { value: number; label: string }) {
    const padded = String(value).padStart(2, "0");
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex gap-1" dir="ltr">
          {padded.split("").map((d, i) => (
            <span
              key={i}
              className="w-10 h-12 sm:w-12 sm:h-14 flex items-center justify-center rounded-lg text-2xl sm:text-3xl font-bold tabular-nums text-white"
              style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
            >
              {toPersianDigits(d)}
            </span>
          ))}
        </div>
        <span className="text-[11px] font-medium tracking-widest text-white/55 uppercase">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-3 sm:gap-4" dir="ltr">
      <Unit value={days} label="روز" />
      <span className="text-3xl font-light text-white/30 mb-4 leading-none">|</span>
      <Unit value={hours} label="ساعت" />
      <span className="text-3xl font-light text-white/30 mb-4 leading-none">|</span>
      <Unit value={minutes} label="دقیقه" />
    </div>
  );
}

// ── Banner ────────────────────────────────────────────────────────────────────

export default function UpcomingHeroBanner({ games }: { games: UpcomingGame[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();

  const next = useCallback(() => setCurrent((i) => (i + 1) % games.length), [games.length]);
  const prev = useCallback(() => setCurrent((i) => (i - 1 + games.length) % games.length), [games.length]);

  const pause6s = useCallback(() => {
    setPaused(true);
    setTimeout(() => setPaused(false), 6000);
  }, []);

  useEffect(() => {
    if (paused || games.length <= 1 || reducedMotion) return;
    const id = setInterval(next, 6000);
    return () => clearInterval(id);
  }, [paused, next, games.length, reducedMotion]);

  if (!games.length) return null;
  const game = games[current];
  const bg = game.keyArtUrl ?? game.coverUrl;

  return (
    <>
    <section
      className="relative overflow-hidden"
      style={{ minHeight: "72vh" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      aria-label="بازی‌های پیش‌خرید ویژه"
      aria-roledescription="carousel"
    >
      {/* Blurred background */}
      <div className="absolute inset-0">
        {bg ? (
          <Image
            src={bg}
            alt=""
            fill
            className="object-cover object-center scale-110 blur-md brightness-[0.45]"
            priority
            aria-hidden
          />
        ) : (
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d0d1a 100%)" }} />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.75) 100%)" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      </div>

      {/* Two-column layout */}
      <div className="relative z-10 flex min-h-[72vh]" dir="ltr">

        {/* LEFT: Main cover image (portrait box art, not key art / screenshot) */}
        <div className="hidden md:block relative w-[42%] shrink-0" aria-hidden>
          {game.coverUrl ? (
            <Image
              src={game.coverUrl}
              alt=""
              fill
              className="object-contain object-bottom drop-shadow-2xl"
              style={{ paddingTop: "28px", paddingLeft: "40px", paddingRight: "24px", paddingBottom: "20px" }}
              priority
              unoptimized
            />
          ) : (
            <div className="absolute bottom-0 left-16 right-4 top-12 flex items-end justify-center">
              <div className="aspect-[3/4] w-full max-w-xs bg-white/10 rounded-2xl ring-1 ring-white/20" />
            </div>
          )}
        </div>

        {/* RIGHT: Info panel — crossfades on slide change */}
        <div
          key={current}
          className="flex-1 flex flex-col justify-end pb-24 px-8 md:px-12 lg:px-16 hero-content-enter"
          dir="rtl"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="max-w-lg text-white">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Chip size="sm" className="bg-amber-500 text-black border-0 text-xs font-bold">پیش‌خرید</Chip>
              <Chip size="sm" className="bg-white/20 text-white border-0 text-xs font-bold">PS5</Chip>
            </div>

            {/* Title */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight mb-3 drop-shadow-lg">
              {game.title}
            </h2>

            {/* Release date */}
            <p className="text-blue-200 text-sm mb-6">
              تاریخ انتشار: {formatPersianDate(game.releaseDate)}
            </p>

            {/* Countdown */}
            <div className="mb-6">
              <HeroCountdown releaseDate={game.releaseDate} />
            </div>

            {/* Price + CTA */}
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href={`/games/${game.slug}`}
                className="inline-flex items-center gap-2 bg-white text-[#003087] font-bold px-7 py-3 rounded-full hover:bg-blue-50 transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                مشاهده پیش‌خرید
              </Link>
              {game.lowestPriceToman && (
                <p className="flex items-baseline gap-1 text-white/70">
                  <span className="text-sm">از</span>
                  <span className="price-figure font-bold text-xl text-white">{formatToman(game.lowestPriceToman)}</span>
                  <span className="text-sm">تومان</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Click zones for prev/next on left/right edges */}
      <button
        onClick={() => { prev(); pause6s(); }}
        aria-label="بازی قبلی"
        className="cursor-pointer absolute right-0 top-0 bottom-0 w-16 z-20 focus-visible:outline-none"
      />
      <button
        onClick={() => { next(); pause6s(); }}
        aria-label="بازی بعدی"
        className="cursor-pointer absolute left-0 top-0 bottom-0 w-16 z-20 focus-visible:outline-none"
      />

    </section>

    {/* Segmented bar indicator — sits on the light page background below the banner */}
    <div className="flex gap-2 mt-1 mb-2" role="tablist" aria-label="انتخاب بازی ویژه">
      {games.map((g, i) => (
        <button
          key={g.slug}
          role="tab"
          aria-selected={i === current}
          aria-label={g.title}
          onClick={() => { setCurrent(i); pause6s(); }}
          className="cursor-pointer flex-1 h-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ps-blue)]"
        >
          <span
            className={`block w-full h-full transition-colors duration-300 ${
              i === current ? "bg-[var(--color-ps-blue)]" : "bg-gray-300 hover:bg-gray-400"
            }`}
          />
        </button>
      ))}
    </div>
    </>
  );
}
