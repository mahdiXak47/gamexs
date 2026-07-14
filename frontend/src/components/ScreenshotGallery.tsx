"use client";

import Image from "next/image";
import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function cardStyle(relPos: number): {
  translateX: string;
  scale: number;
  opacity: number;
  zIndex: number;
} | null {
  if (Math.abs(relPos) > 2) return null;
  const abs = Math.abs(relPos);
  return {
    translateX: `${relPos * 62}%`,
    scale: abs === 0 ? 1 : abs === 1 ? 0.8 : 0.65,
    opacity: abs === 0 ? 1 : abs === 1 ? 0.75 : 0.45,
    zIndex: 10 - abs * 3,
  };
}

function ChevronLeft({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Fullscreen lightbox rendered via portal — floats above everything
// ---------------------------------------------------------------------------
function Lightbox({
  screenshots,
  initialIndex,
  onClose,
}: {
  screenshots: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [visible, setVisible] = useState(false);   // controls enter animation
  const [closing, setClosing] = useState(false);   // controls exit animation
  const total = screenshots.length;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const prefersReduced = useRef(
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const go = useCallback((dir: number) => setIndex((i) => mod(i + dir, total)), [total]);

  // Trigger enter animation after first paint
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Focus the close button on open
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const triggerClose = useCallback(() => {
    if (closing) return;
    if (prefersReduced.current) { onClose(); return; }
    setClosing(true);
    setTimeout(onClose, 180);
  }, [closing, onClose]);

  // Keyboard: arrows + Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") triggerClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, triggerClose]);

  const reduced = prefersReduced.current;

  const backdropStyle: React.CSSProperties = {
    opacity: closing ? 0 : visible ? 1 : 0,
    transition: reduced ? "none" : closing
      ? "opacity 180ms ease-in"
      : "opacity 220ms ease-out",
  };

  const panelStyle: React.CSSProperties = {
    transform: closing
      ? "scale(0.94)"
      : visible ? "scale(1)" : "scale(0.94)",
    opacity: closing ? 0 : visible ? 1 : 0,
    transition: reduced ? "none" : closing
      ? "transform 180ms ease-in, opacity 180ms ease-in"
      : "transform 260ms ease-out, opacity 260ms ease-out",
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="نمایش تمام‌صفحه تصاویر بازی"
      dir="ltr"
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={backdropStyle}
    >
      {/* Backdrop — click to close */}
      <div
        className="absolute inset-0 bg-black/92 backdrop-blur-sm"
        onClick={triggerClose}
        aria-hidden
      />

      {/* Main panel */}
      <div className="relative w-full h-full flex flex-col" style={panelStyle}>

        {/* Top bar: counter + close */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2 pointer-events-none">
          <span className="text-white/70 text-sm font-medium tabular-nums select-none">
            {index + 1} / {total}
          </span>
          <button
            ref={closeButtonRef}
            onClick={triggerClose}
            className="pointer-events-auto w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label="بستن"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Image area */}
        <div
          className="relative flex-1 mx-4 mb-4"
          onTouchStart={(e) => {
            touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }}
          onTouchEnd={(e) => {
            if (!touchStartRef.current) return;
            const dx = touchStartRef.current.x - e.changedTouches[0].clientX;
            const dy = touchStartRef.current.y - e.changedTouches[0].clientY;
            touchStartRef.current = null;
            if (Math.abs(dy) > Math.abs(dx) && dy < -60) { triggerClose(); return; }
            if (Math.abs(dx) > 50) go(dx > 0 ? 1 : -1);
          }}
        >
          <Image
            key={index}
            src={screenshots[index]}
            alt={`تصویر ${index + 1} از ${total}`}
            fill
            className="object-contain"
            sizes="100vw"
            priority
          />

          {/* Side nav arrows */}
          {total > 1 && (
            <>
              <button
                className="absolute left-0 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                onClick={() => go(-1)}
                aria-label="تصویر قبلی"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                onClick={() => go(1)}
                aria-label="تصویر بعدی"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}
        </div>

        {/* Dot indicators */}
        {total > 1 && (
          <div className="relative z-10 flex justify-center gap-1.5 pb-5" role="tablist" aria-label="انتخاب تصویر">
            {screenshots.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === index}
                aria-label={`تصویر ${i + 1}`}
                onClick={() => setIndex(i)}
                className="flex items-center justify-center w-8 h-5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/60 rounded"
              >
                <span
                  className="block rounded-full transition-all duration-300"
                  style={{
                    width: i === index ? 20 : 6,
                    height: 6,
                    background: i === index ? "white" : "rgba(255,255,255,0.35)",
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Carousel
// ---------------------------------------------------------------------------
export default function ScreenshotGallery({ screenshots }: { screenshots: string[] }) {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const total = screenshots.length;
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (dir: number) => setCurrent((c) => mod(c + dir, total)),
    [total]
  );

  // Carousel keyboard nav (disabled while lightbox is open)
  useEffect(() => {
    if (lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, lightboxOpen]);

  if (total === 0) return null;

  return (
    <>
      <section aria-label="تصاویر بازی" className="mt-10">
        <h2 className="text-lg font-bold text-gray-900 mb-6" dir="rtl">
          تصاویر بازی
        </h2>

        <div
          dir="ltr"
          className="relative overflow-hidden rounded-2xl bg-gray-950"
          style={{ aspectRatio: "3 / 1" }}
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const diff = touchX.current - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) go(diff > 0 ? 1 : -1);
            touchX.current = null;
          }}
          aria-roledescription="carousel"
        >
          {screenshots.map((url, i) => {
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
                  left: "20%",
                  width: "60%",
                  transform: `translateX(${style.translateX}) scale(${style.scale})`,
                  opacity: style.opacity,
                  zIndex: style.zIndex,
                  transition: "transform 300ms ease-out, opacity 300ms ease-out",
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (isCenter) {
                    setLightboxOpen(true);
                  } else {
                    setCurrent(i);
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    if (isCenter) setLightboxOpen(true);
                    else setCurrent(i);
                  }
                }}
                aria-label={isCenter ? `تصویر ${i + 1} — برای نمایش تمام‌صفحه کلیک کنید` : `تصویر ${i + 1} را انتخاب کنید`}
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

                  {!isCenter && (
                    <div className="absolute inset-0 bg-black/35 group-hover:bg-black/10 transition-colors duration-200" />
                  )}

                  {isCenter && (
                    <>
                      {/* Blue focus ring */}
                      <div className="absolute inset-0 rounded-xl ring-2 ring-inset ring-ps-blue/60 pointer-events-none" />
                      {/* Expand hint — appears on hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                        <div className="bg-black/50 rounded-full p-3 text-white backdrop-blur-sm">
                          <ExpandIcon />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

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

        {total > 1 && (
          <div className="flex justify-center gap-1 mt-4" role="tablist" aria-label="انتخاب تصویر">
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

      {lightboxOpen && (
        <Lightbox
          screenshots={screenshots}
          initialIndex={current}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
