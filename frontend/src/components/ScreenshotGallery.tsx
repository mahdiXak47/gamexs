"use client";

import Image from "next/image";
import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
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
  const [reduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
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
    if (reduced) { onClose(); return; }
    setClosing(true);
    setTimeout(onClose, 180);
  }, [closing, onClose, reduced]);

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
// Screenshot strip — PlayStation Store-style 4-up gallery
// ---------------------------------------------------------------------------
export default function ScreenshotGallery({ screenshots }: { screenshots: string[] }) {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const total = screenshots.length;
  const touchX = useRef<number | null>(null);

  const go = useCallback((dir: number) => setCurrent((c) => mod(c + dir, total)), [total]);

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

  const maxStart = Math.max(0, total - 4);
  const windowStart = Math.min(current, maxStart);
  const visibleScreenshots = screenshots
    .map((src, index) => ({ src, index }))
    .slice(windowStart, windowStart + 4);

  return (
    <>
      <section
        aria-label="تصاویر بازی"
        className="mt-10 py-10"
        dir="ltr"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const diff = touchX.current - e.changedTouches[0].clientX;
          if (Math.abs(diff) > 50) go(diff > 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {/* Heading — kept at page content width */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-6" dir="rtl">
          <h2 className="text-lg font-bold text-gray-900">تصاویر بازی</h2>
        </div>

        <div className="group/gallery relative max-w-6xl mx-auto px-4 sm:px-6" aria-roledescription="carousel">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {visibleScreenshots.map(({ src, index }) => (
              <button
                key={`${src}-${index}`}
                className="group relative aspect-video overflow-hidden rounded-md bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                onClick={() => {
                  setCurrent(index);
                  setLightboxOpen(true);
                }}
                aria-label={`تصویر ${index + 1} — برای نمایش بزرگ‌تر کلیک کنید`}
              >
                <Image
                  src={src}
                  alt={`تصویر ${index + 1}`}
                  fill
                  className="object-cover transition-transform duration-200 ease-out group-hover:scale-[1.04]"
                  sizes="(max-width: 768px) 50vw, 25vw"
                  priority={index === current}
                />
                <span
                  className={`absolute inset-x-0 bottom-0 h-0.5 transition-colors duration-200 ${
                    index === current ? "bg-ps-blue" : "bg-transparent"
                  }`}
                />
              </button>
            ))}
          </div>

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-800 shadow-lg opacity-100 transition-opacity duration-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue sm:left-6 md:opacity-0 md:group-hover/gallery:opacity-100"
                aria-label="تصویر قبلی"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-4 top-1/2 z-10 flex h-11 w-11 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-800 shadow-lg opacity-100 transition-opacity duration-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue sm:right-6 md:opacity-0 md:group-hover/gallery:opacity-100"
                aria-label="تصویر بعدی"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        {total > 1 && (
          <div
            className="mx-auto mt-4 flex max-w-xs justify-center gap-1.5 px-4 sm:max-w-sm"
            role="status"
            aria-label={`تصویر ${current + 1} از ${total}`}
          >
            {screenshots.map((_, i) => (
              <span
                key={i}
                aria-label={`تصویر ${i + 1}`}
                className="flex h-5 flex-1 items-center"
              >
                <span
                  className={`block h-[4px] w-full rounded-full transition-colors duration-200 ${
                    i === current
                      ? "bg-ps-blue"
                      : "bg-gray-300"
                  }`}
                />
              </span>
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
