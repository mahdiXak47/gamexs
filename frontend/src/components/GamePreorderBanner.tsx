"use client";

import { useEffect, useReducer, useRef } from "react";
import { toPersianDigits } from "@/lib/format";

function computeRemaining(isoDate: string) {
  const diff = Math.max(0, new Date(isoDate).getTime() - Date.now());
  const totalSec = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

function isInFuture(isoDate: string) {
  return new Date(isoDate).getTime() > Date.now();
}

function Unit({ value, label, wide }: { value: number; label: string; wide?: boolean }) {
  const digits = wide
    ? String(value).padStart(3, "0")
    : String(value).padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3">
      <div className="flex gap-1 sm:gap-1.5" dir="ltr">
        {digits.split("").map((d, i) => (
          <span
            key={i}
            className="flex items-center justify-center rounded-lg sm:rounded-xl tabular-nums font-black text-white leading-none select-none"
            style={{
              width: "clamp(40px, 7vw, 88px)",
              height: "clamp(56px, 10vw, 120px)",
              fontSize: "clamp(28px, 5.5vw, 76px)",
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.25)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {toPersianDigits(d)}
          </span>
        ))}
      </div>
      <span
        className="text-white/50 font-semibold tracking-widest uppercase"
        style={{ fontSize: "clamp(9px, 1.2vw, 13px)", letterSpacing: "0.15em" }}
      >
        {label}
      </span>
    </div>
  );
}

function Separator() {
  return (
    <span
      className="text-white/20 font-thin self-start mt-3 sm:mt-4 leading-none select-none"
      style={{ fontSize: "clamp(32px, 6vw, 80px)" }}
      aria-hidden
    >
      |
    </span>
  );
}

export default function GamePreorderBanner({
  releaseDate,
  keyArtUrl,
  title,
}: {
  releaseDate: string;
  keyArtUrl: string | null;
  title: string;
}) {
  if (!isInFuture(releaseDate)) return null;

  return <BannerInner releaseDate={releaseDate} keyArtUrl={keyArtUrl} title={title} />;
}

function BannerInner({
  releaseDate,
  keyArtUrl,
  title,
}: {
  releaseDate: string;
  keyArtUrl: string | null;
  title: string;
}) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    const id = setInterval(() => {
      if (aliveRef.current) tick();
    }, 1000);
    return () => {
      aliveRef.current = false;
      clearInterval(id);
    };
  }, []);

  const { days, hours, minutes, seconds } = computeRemaining(releaseDate);
  const daysWide = days >= 100;

  const persianDate = new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(releaseDate));

  return (
    <div
      className="relative overflow-hidden w-full"
      style={{ minHeight: "clamp(200px, 30vw, 360px)" }}
      aria-label={`شمارش معکوس تا انتشار ${title}`}
      role="timer"
      aria-live="off"
    >
      {/* Blue base layer — always present */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(135deg, #003087 0%, #0050b3 100%)" }}
      />

      {/* Key art on top of blue, blended via multiply-like opacity */}
      {keyArtUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={keyArtUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover object-center scale-110 mix-blend-overlay"
          style={{ filter: "blur(12px)", opacity: 0.35 }}
        />
      )}

      {/* Top + bottom fade to blend with surrounding sections */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,48,135,0.7) 0%, transparent 35%, transparent 65%, rgba(0,48,135,0.7) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 py-10 sm:py-14 gap-4 sm:gap-6 text-center">
        {/* Pre-order label */}
        <p className="text-xs sm:text-sm font-semibold tracking-[0.25em] uppercase text-white/45">
          پیش‌خرید &mdash; {persianDate}
        </p>

        {/* Countdown row */}
        <div className="flex items-start justify-center gap-2 sm:gap-3 md:gap-4" dir="ltr">
          <Unit value={days} label="روز" wide={daysWide} />
          <Separator />
          <Unit value={hours} label="ساعت" />
          <Separator />
          <Unit value={minutes} label="دقیقه" />
          <Separator />
          <Unit value={seconds} label="ثانیه" />
        </div>
      </div>
    </div>
  );
}
