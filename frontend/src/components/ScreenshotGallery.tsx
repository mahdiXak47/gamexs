"use client";

import Image from "next/image";
import { useState, useCallback, useEffect, useRef } from "react";

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

// Compute transform values for a card at a given relative position.
function cardStyle(relPos: number): {
  translateX: string;
  scale: number;
  opacity: number;
  zIndex: number;
} | null {
  if (Math.abs(relPos) > 2) return null; // only render ±2 around center
  const abs = Math.abs(relPos);
  return {
    // 62% of card's own width per step — creates overlap + edge peek effect
    translateX: `${relPos * 62}%`,
    scale: abs === 0 ? 1 : abs === 1 ? 0.8 : 0.65,
    opacity: abs === 0 ? 1 : abs === 1 ? 0.75 : 0.45,
    zIndex: 10 - abs * 3,
  };
}

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

export default function ScreenshotGallery({ screenshots }: { screenshots: string[] }) {
  const [current, setCurrent] = useState(0);
  const total = screenshots.length;
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (dir: number) => setCurrent((c) => mod(c + dir, total)),
    [total]
  );

  // Keyboard navigation (left/right arrows)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (total === 0) return null;

  return (
    <section aria-label="تصاویر بازی" className="mt-10">
      <h2 className="text-lg font-bold text-gray-900 mb-6" dir="rtl">
        تصاویر بازی
      </h2>

      {/* Coverflow carousel
          Container aspect ratio 3:1 makes the center card (60% wide) display at 16:9.
          dir="ltr" keeps physical left = previous regardless of page RTL direction.     */}
      <div
        dir="ltr"
        className="relative overflow-hidden rounded-2xl bg-gray-950"
        style={{ aspectRatio: "3 / 1" }}
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const diff = touchX.current - e.changedTouches[0].clientX;
          if (Math.abs(diff) > 50) go(diff > 0 ? 1 : -1);
          touchX.current = null;
        }}
        aria-roledescription="carousel"
      >
        {screenshots.map((url, i) => {
          // Circular offset: maps each screenshot index to a position relative to current.
          const half = Math.floor(total / 2);
          const relPos = mod(i - current + half, total) - half;
          const style = cardStyle(relPos);
          if (!style) return null;

          const isCenter = relPos === 0;

          return (
            <div
              key={i}
              className="absolute top-0 h-full"
              style={{
                left: "20%",     // (100 - 60) / 2 = centers the 60%-wide card
                width: "60%",
                transform: `translateX(${style.translateX}) scale(${style.scale})`,
                opacity: style.opacity,
                zIndex: style.zIndex,
                transition:
                  "transform 300ms ease-out, opacity 300ms ease-out",
                cursor: isCenter ? "default" : "pointer",
              }}
              onClick={!isCenter ? () => setCurrent(i) : undefined}
              role={!isCenter ? "button" : undefined}
              tabIndex={!isCenter ? 0 : undefined}
              onKeyDown={
                !isCenter
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") setCurrent(i);
                    }
                  : undefined
              }
              aria-label={!isCenter ? `تصویر ${i + 1} را انتخاب کنید` : undefined}
            >
              <div className="relative w-full h-full rounded-xl overflow-hidden group">
                <Image
                  src={url}
                  alt={isCenter ? `تصویر ${i + 1} (انتخاب شده)` : `تصویر ${i + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 80vw, 60vw"
                  priority={isCenter}
                />

                {/* Dimming overlay — lightens on hover for non-center cards */}
                {!isCenter && (
                  <div className="absolute inset-0 bg-black/35 group-hover:bg-black/10 transition-colors duration-200" />
                )}

                {/* Blue ring on the selected center card */}
                {isCenter && (
                  <div className="absolute inset-0 rounded-xl ring-2 ring-inset ring-ps-blue/60 pointer-events-none" />
                )}
              </div>
            </div>
          );
        })}

        {/* Navigation arrows — 44×44px touch targets (UX min) */}
        {total > 1 && (
          <>
            <button
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue"
              onClick={() => go(-1)}
              aria-label="تصویر قبلی"
            >
              <ChevronLeft />
            </button>
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue"
              onClick={() => go(1)}
              aria-label="تصویر بعدی"
            >
              <ChevronRight />
            </button>
          </>
        )}
      </div>

      {/* Dot indicators — 44×44px touch targets with small visual dot inside */}
      {total > 1 && (
        <div
          className="flex justify-center gap-1 mt-4"
          role="tablist"
          aria-label="انتخاب تصویر"
        >
          {screenshots.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === current}
              aria-label={`تصویر ${i + 1}`}
              onClick={() => setCurrent(i)}
              className="flex items-center justify-center w-11 h-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue focus-visible:ring-offset-2 rounded"
            >
              <span
                className={`block rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-5 h-1.5 bg-ps-blue"
                    : "w-1.5 h-1.5 bg-gray-300 hover:bg-gray-500"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
