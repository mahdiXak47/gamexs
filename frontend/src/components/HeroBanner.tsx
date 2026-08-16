"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Chip } from "@heroui/react";
import { formatToman } from "@/lib/format";
import type { GameSummary, HeroPriceOption } from "@/lib/types";

interface HeroBannerCopy {
  ariaLabel?: string;
  badge?: string;
  cta?: string;
  pricePrefix?: string;
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

function buyHashForHeroKey(key: HeroPriceOption["key"]) {
  return `buy-${key}`;
}

function HeroPriceRail({ gameSlug, options }: { gameSlug: string; options: HeroPriceOption[] }) {
  if (options.length === 0) return null;

  return (
    <aside
      className="hero-content-enter hidden w-full max-w-sm rounded-2xl border border-white/12 bg-black/28 p-3 shadow-2xl backdrop-blur-xl md:block lg:w-80"
      aria-label="کمترین قیمت بر اساس مدل خرید"
    >
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <p className="text-xs font-bold text-white/86">کمترین قیمت هر مدل خرید</p>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/60">
          تومان
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {options.map((option, index) => (
          <Link
            key={option.key}
            href={`/games/${gameSlug}#${buyHashForHeroKey(option.key)}`}
            className="ui-stagger-card flex min-h-12 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.09] px-3 py-2 transition-[background-color,border-color,transform] duration-150 hover:-translate-x-0.5 hover:border-white/20 hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
            style={{ animationDelay: `${index * 32}ms` }}
          >
            <span className="text-xs font-semibold text-blue-50/80">{option.label}</span>
            {option.priceToman === null ? (
              <span className="text-xs font-semibold text-white/[0.34]">ناموجود</span>
            ) : (
              <span className="price-figure text-sm font-black text-white">
                {formatToman(option.priceToman)}
              </span>
            )}
          </Link>
        ))}
      </div>
    </aside>
  );
}

export default function HeroBanner({
  games,
  copy = {},
}: {
  games: GameSummary[];
  copy?: HeroBannerCopy;
}) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [previousBackgroundUrl, setPreviousBackgroundUrl] = useState<string | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const backgroundFadeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reducedMotion = useReducedMotion();

  const pauseTemporarily = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    setPaused(true);
    resumeTimer.current = setTimeout(() => setPaused(false), 6000);
  }, []);

  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      if (backgroundFadeTimer.current) clearTimeout(backgroundFadeTimer.current);
    };
  }, []);

  const game = games[current] ?? null;
  const backgroundUrl = game ? game.mainBackgroundImageUrl ?? game.screenshotUrl ?? game.coverUrl : null;

  const switchTo = useCallback((i: number) => {
    if (i === current) return;
    if (!reducedMotion && backgroundUrl) {
      if (backgroundFadeTimer.current) clearTimeout(backgroundFadeTimer.current);
      setPreviousBackgroundUrl(backgroundUrl);
      backgroundFadeTimer.current = setTimeout(() => setPreviousBackgroundUrl(null), 420);
    }
    setCurrent(i);
  }, [backgroundUrl, current, reducedMotion]);

  const goTo = (i: number) => {
    switchTo(i);
    pauseTemporarily();
  };

  // Auto-advance — stopped when paused, user prefers reduced motion, or only 1 slide.
  useEffect(() => {
    if (paused || games.length <= 1 || reducedMotion) return;
    const id = setInterval(() => {
      switchTo((current + 1) % games.length);
    }, 5000);
    return () => clearInterval(id);
  }, [current, games.length, paused, reducedMotion, switchTo]);

  if (!game) return null;
  const heroPriceOptions = game.heroPriceOptions ?? [];
  const capacity2Price = heroPriceOptions.find((option) => option.key === "capacity_2")?.priceToman ?? null;

  return (
    <section
      className="relative min-h-dvh overflow-hidden bg-[#07101f] text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      aria-label={copy.ariaLabel ?? "بازی‌های ویژه"}
      aria-roledescription="carousel"
    >
      <div className="absolute inset-0" aria-hidden>
        {previousBackgroundUrl && (
          <Image
            key={`previous-${previousBackgroundUrl}`}
            src={previousBackgroundUrl}
            alt=""
            fill
            sizes="100vw"
            className="hero-background-exit object-cover object-center"
          />
        )}
        {backgroundUrl ? (
          <Image
            key={backgroundUrl}
            src={backgroundUrl}
            alt=""
            fill
            sizes="100vw"
            className="hero-background-enter object-cover object-center"
            priority
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_28%_30%,rgba(246,184,41,0.28),transparent_34%),linear-gradient(135deg,#07101f_0%,#003087_54%,#050712_100%)]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,18,0.2)_0%,rgba(3,7,18,0.58)_42%,rgba(3,7,18,0.9)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(3,7,18,0.96)_0%,rgba(3,7,18,0.42)_34%,rgba(3,7,18,0.12)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col justify-between px-4 pb-5 pt-20 sm:px-6 lg:justify-end">
        <div
          key={current}
          className="mb-8 flex flex-col gap-5 sm:mb-10 lg:mb-12 lg:flex-row lg:items-end lg:justify-between lg:gap-8"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="hero-content-enter w-full max-w-xl self-end text-right">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Chip size="sm" className="border-0 bg-ps-plus-gold text-xs font-extrabold text-gray-950">
                {copy.badge ?? "PS5"}
              </Chip>
              {game.genreLabel && (
                <Chip size="sm" className="border-0 bg-white/18 text-xs font-semibold text-white backdrop-blur-md">{game.genreLabel}</Chip>
              )}
              {game.storeCount > 0 && (
                <Chip size="sm" className="border-0 bg-white/12 text-xs font-semibold text-blue-50 backdrop-blur-md">
                  {game.storeCount} فروشنده
                </Chip>
              )}
            </div>

            <h2 dir="auto" className="mb-5 text-right text-3xl font-black leading-tight drop-shadow-2xl sm:text-5xl lg:text-6xl">
              {game.title}
            </h2>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href={`/games/${game.slug}#${buyHashForHeroKey("capacity_2")}`}
                className="hero-cta inline-flex min-h-12 w-fit cursor-pointer items-center justify-center rounded-lg bg-ps-plus-gold px-7 py-3 text-sm font-extrabold text-gray-950 shadow-[0_14px_32px_rgba(246,184,41,0.24)] transition-[background-color,box-shadow,transform] duration-200 hover:bg-[#ffd35a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                {copy.cta ?? "مشاهده قیمت‌ها"}
              </Link>

              {capacity2Price !== null && (
                <div className="min-w-0 border-r border-white/20 pr-4">
                  <p className="flex flex-wrap items-baseline gap-1.5">
                    <span className="text-xs font-semibold text-blue-100/90">{copy.pricePrefix ?? "شروع از"}</span>
                    <span className="price-figure text-2xl font-black text-white sm:text-3xl">{formatToman(capacity2Price)}</span>
                    <span className="text-xs font-semibold text-blue-100/90">تومان</span>
                  </p>
                  <p className="mt-1 text-xs font-semibold text-ps-plus-gold">
                    ظرفیت ۲
                  </p>
                </div>
              )}
            </div>
          </div>

          <HeroPriceRail gameSlug={game.slug} options={heroPriceOptions} />
        </div>

        {games.length > 1 && (
          <div className="flex items-center" dir="ltr">
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
                  className={`group relative aspect-[4/5] cursor-pointer overflow-hidden rounded-lg bg-white/10 text-right shadow-lg transition-[opacity,transform] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    i === current ? "scale-[1.04] opacity-100" : "opacity-75 hover:scale-105 hover:opacity-100"
                  }`}
                >
                  {g.coverUrl ? (
                    <Image
                      src={g.coverUrl}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 112px, (max-width: 768px) 132px, 148px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-ps-blue text-xl font-black text-white">
                      {g.coverInitial}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
