"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "./RemoteImage";
import type { UpcomingGame } from "@/lib/types";
import CountdownTimer from "./CountdownTimer";
import { formatToman, toPersianDigits } from "@/lib/format";

function formatPersianDate(isoDate: string): string {
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(isoDate));
}

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

export default function UpcomingGames({ games }: { games: UpcomingGame[] }) {
  const slides = games.slice(0, 4);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [previousBackgroundUrl, setPreviousBackgroundUrl] = useState<string | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const backgroundFadeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reducedMotion = useReducedMotion();

  const game = slides[current] ?? null;
  const backgroundUrl = game ? game.mainBackgroundImageUrl ?? game.coverUrl : null;

  const pauseTemporarily = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    setPaused(true);
    resumeTimer.current = setTimeout(() => setPaused(false), 6000);
  }, []);

  const switchTo = useCallback((index: number) => {
    if (index === current) return;
    if (!reducedMotion && backgroundUrl) {
      if (backgroundFadeTimer.current) clearTimeout(backgroundFadeTimer.current);
      setPreviousBackgroundUrl(backgroundUrl);
      backgroundFadeTimer.current = setTimeout(() => setPreviousBackgroundUrl(null), 420);
    }
    setCurrent(index);
  }, [backgroundUrl, current, reducedMotion]);

  const goTo = (index: number) => {
    switchTo(index);
    pauseTemporarily();
  };

  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      if (backgroundFadeTimer.current) clearTimeout(backgroundFadeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || slides.length <= 1) return;
    const id = setInterval(() => {
      switchTo((current + 1) % slides.length);
    }, 5000);
    return () => clearInterval(id);
  }, [current, paused, reducedMotion, slides.length, switchTo]);

  if (!game) return null;

  return (
    <section aria-labelledby="upcoming-heading" className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6" dir="rtl">
      <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col items-end text-right" dir="ltr">
          <div className="mb-2 h-1 w-16 rounded-full bg-ps-plus-gold" />
          <h2
            id="upcoming-heading"
            className="text-2xl font-extrabold leading-tight text-gray-900 sm:text-3xl"
            dir="rtl"
          >
            پرانتظارترین بازی‌ها
          </h2>
          <div className="mt-2 h-1 w-16 rounded-full bg-[#55d0ad]" />
        </div>

        <Link
          href="/upcoming"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-[var(--color-ps-blue)] px-5 py-2.5 text-sm font-black text-[var(--color-ps-blue)] transition-[background-color,color,transform] duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-ps-blue)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ps-blue)] focus-visible:ring-offset-2"
        >
          مشاهده همه
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      </div>

      <div
        className="relative min-h-[640px] w-full overflow-hidden rounded-2xl bg-[#07101f] text-white shadow-[0_24px_64px_rgba(7,16,31,0.24)] sm:min-h-[660px] md:aspect-[16/9] md:min-h-[560px] lg:min-h-[620px]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
        aria-roledescription="carousel"
        aria-label="پرانتظارترین بازی‌ها"
      >
        <div className="absolute inset-0" aria-hidden>
          {previousBackgroundUrl && (
            <Image
              key={`previous-${previousBackgroundUrl}`}
              src={previousBackgroundUrl}
              alt=""
              fill
              sizes="(max-width: 1280px) 100vw, 1280px"
              className="hero-background-exit object-cover object-center"
            />
          )}
          {backgroundUrl ? (
            <Image
              key={backgroundUrl}
              src={backgroundUrl}
              alt=""
              fill
              sizes="(max-width: 1280px) 100vw, 1280px"
              className="hero-background-enter object-cover object-center"
            />
          ) : (
            <div className="h-full w-full bg-[linear-gradient(135deg,#07101f_0%,#003087_54%,#050712_100%)]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,18,0.1)_0%,rgba(3,7,18,0.52)_42%,rgba(3,7,18,0.92)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(3,7,18,0.96)_0%,rgba(3,7,18,0.42)_34%,rgba(3,7,18,0.12)_100%)]" />
        </div>

        <div className="relative z-10 flex h-full min-h-[640px] flex-col justify-between gap-5 px-4 pb-5 pt-6 sm:min-h-[660px] sm:px-8 sm:pb-7 md:min-h-[560px] lg:min-h-0 lg:pt-10">
          <div key={game.slug} className="hero-content-enter flex items-start justify-between gap-6" dir="ltr">
            <div className="order-2 flex w-full max-w-2xl flex-col items-end text-right" dir="ltr">
              <div className="mb-4 flex flex-wrap items-center justify-end gap-2" dir="rtl" aria-label="مشخصات بازی">
                <span className="rounded-full bg-ps-plus-gold px-3 py-1 text-xs font-black text-gray-950 sm:text-sm">
                  PS5
                </span>
                {game.genreLabel && (
                  <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-extrabold text-white shadow-sm backdrop-blur-sm sm:text-sm">
                    {game.genreLabel}
                  </span>
                )}
                <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-extrabold text-white shadow-sm backdrop-blur-sm sm:text-sm">
                  {toPersianDigits(game.sellerCount)} فروشنده
                </span>
              </div>

              <h3 dir="auto" className="mb-4 w-full text-right text-3xl font-black leading-tight drop-shadow-2xl sm:text-5xl">
                {game.title}
              </h3>

              <div className="mb-5 flex w-full flex-col items-end gap-2 text-right text-white/82">
                {game.capacity2PriceToman && (
                  <div className="flex w-full flex-col items-end gap-1 text-right" dir="ltr">
                    <p className="text-xs font-extrabold text-ps-plus-gold" dir="rtl">ظرفیت ۲</p>
                    <p className="price-figure text-base font-semibold text-white/72" dir="rtl">
                      از {formatToman(game.capacity2PriceToman)} تومان
                    </p>
                  </div>
                )}
              </div>

              <Link
                href={`/games/${game.slug}`}
                className="inline-flex min-h-12 cursor-pointer items-center justify-center self-end rounded-lg bg-ps-plus-gold px-6 py-3 text-sm font-extrabold text-gray-950 shadow-[0_14px_32px_rgba(246,184,41,0.24)] transition-[background-color,box-shadow,transform] duration-200 hover:bg-[#ffd35a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent sm:px-7"
                dir="rtl"
              >
                مشاهده پیش‌خرید
              </Link>
            </div>

            <div className="order-1 hidden lg:block" aria-hidden />
          </div>

          {slides.length > 1 && (
            <div className="flex flex-col items-start gap-4 sm:gap-5 lg:absolute lg:bottom-7 lg:left-8 lg:w-[600px]" dir="ltr">
              <div className="flex flex-col items-start gap-3" dir="ltr">
                <p className="w-fit border-b border-white/45 pb-1 text-base font-semibold text-white/82" dir="rtl">
                  {formatPersianDate(game.releaseDate)}
                </p>
                <CountdownTimer releaseDate={game.releaseDate} />
              </div>
              <div
                className="hide-scrollbar grid max-w-full auto-cols-[82px] grid-flow-col gap-3 overflow-x-auto pb-1 sm:auto-cols-[118px] md:auto-cols-[136px] lg:auto-cols-[136px]"
                dir="rtl"
                role="tablist"
                aria-label="انتخاب بازی پیش‌خرید"
              >
                {slides.map((slide, index) => (
                  <button
                    key={slide.slug}
                    type="button"
                    role="tab"
                    aria-selected={index === current}
                    aria-label={slide.title}
                    onClick={() => goTo(index)}
                    className={`group relative aspect-[4/5] cursor-pointer overflow-hidden rounded-lg bg-white/10 text-right shadow-lg transition-[opacity,transform] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                      index === current ? "scale-[1.04] opacity-100" : "opacity-75 hover:scale-105 hover:opacity-100"
                    }`}
                  >
                    {slide.coverUrl ? (
                      <Image
                        src={slide.coverUrl}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 96px, (max-width: 768px) 118px, 136px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-ps-blue text-xl font-black text-white">
                        {slide.title.trim().slice(0, 2).toUpperCase() || "?"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
