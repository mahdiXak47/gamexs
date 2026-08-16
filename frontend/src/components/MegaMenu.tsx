"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { GENRES } from "@/lib/genres";

interface GamePreview {
  slug: string;
  title: string;
  coverUrl: string | null;
}

export default function MegaMenu({
  onMouseEnter,
  onMouseLeave,
  onClose,
}: {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [games, setGames] = useState<GamePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Reset loading when the hovered genre changes (render-phase adjustment,
  // so the fetch effect never calls setState synchronously).
  const [prevIdx, setPrevIdx] = useState(activeIdx);
  if (prevIdx !== activeIdx) {
    setPrevIdx(activeIdx);
    setLoading(true);
    setGames([]);
    setError(false);
  }

  useEffect(() => {
    const genre = GENRES[activeIdx].genre;
    const controller = new AbortController();

    async function loadPreview() {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(`/api/genre-games?genre=${encodeURIComponent(genre)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("genre_preview_failed");
        const data = await response.json();
        setGames(Array.isArray(data) ? data : []);
      } catch {
        if (controller.signal.aborted) return;
        setGames([]);
        setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadPreview();
    return () => controller.abort();
  }, [activeIdx, retryCount]);

  return (
    <div
      className="header-mega-menu fixed left-1/2 z-[200] overflow-hidden rounded-b-2xl shadow-2xl"
      style={{
        top: "60px",
        width: "min(96vw, 760px)",
        background: "linear-gradient(180deg, #020e24 0%, #010918 100%)",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="px-6 py-5 flex gap-6" dir="rtl">

        {/* RIGHT: Category list */}
        <nav className="shrink-0 w-48 flex flex-col gap-0.5" aria-label="دسته‌بندی بازی‌ها">
          {GENRES.map((cat, i) => (
            <Link
              key={cat.slug}
              href={`/genres/${cat.slug}`}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={onClose}
              className={`mega-category-link block w-full rounded-lg px-4 py-2.5 text-right text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                i === activeIdx
                  ? "bg-white/12 text-white font-semibold"
                  : "text-white/60 hover:text-white hover:bg-white/8"
              }`}
            >
              {cat.label}
            </Link>
          ))}
        </nav>

        {/* Divider */}
        <div className="w-px bg-white/10 shrink-0 my-1" />

        {/* LEFT: Top 6 game covers — 2 rows × 3 columns */}
        <div className="flex-1">
          <div className="mb-4 flex justify-end">
            <Link
              href={`/genres/${GENRES[activeIdx].slug}`}
              onClick={onClose}
              className="inline-flex min-h-10 items-center rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition-[background-color,color,transform] duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              مشاهده همه بازی‌های این دسته‌بندی
            </Link>
          </div>
          {loading ? (
            <div key={`loading-${activeIdx}`} className="mega-games-panel grid grid-cols-3 gap-x-3 gap-y-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="w-full aspect-[3/4] rounded-lg bg-white/8 animate-pulse" />
                  <div className="h-2.5 w-3/4 rounded bg-white/8 animate-pulse" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div key={`error-${activeIdx}`} className="mega-games-panel rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-center" role="status">
              <p className="text-sm font-semibold text-white/75">پیش‌نمایش این دسته موقتاً در دسترس نیست</p>
              <p className="mt-1 text-xs leading-5 text-white/40">
                همچنان می‌توانید وارد صفحه کامل دسته‌بندی شوید.
              </p>
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="mt-3 inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg border border-white/15 px-3 text-xs font-bold text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                تلاش دوباره
              </button>
            </div>
          ) : games.length === 0 ? (
            <p key={`empty-${activeIdx}`} className="mega-games-panel text-white/30 text-sm pt-4">بازی‌ای در این دسته یافت نشد</p>
          ) : (
            <div key={`games-${activeIdx}`} className="mega-games-panel grid grid-cols-3 gap-x-3 gap-y-4 items-start">
              {games.map((game, index) => (
                <Link
                  key={game.slug}
                  href={`/games/${game.slug}`}
                  onClick={onClose}
                  className="mega-game-card group flex flex-col gap-1.5"
                  style={{ animationDelay: `${index * 35}ms` }}
                >
                  <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden ring-1 ring-white/15 transition-[box-shadow,transform] duration-200 group-hover:scale-[1.035] group-hover:shadow-[0_14px_28px_rgba(0,0,0,0.35)]">
                    {game.coverUrl ? (
                      <Image
                        src={game.coverUrl}
                        alt={game.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        sizes="150px"
                      />
                    ) : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center">
                        <span className="text-white/30 text-lg font-bold">
                          {game.title.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <p dir="auto" className="text-white/65 text-[11px] font-medium truncate group-hover:text-white transition-colors text-center">
                    {game.title}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
