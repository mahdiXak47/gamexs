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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const genre = GENRES[activeIdx].genre;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/genre-games?genre=${encodeURIComponent(genre)}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) { setGames(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeIdx]);

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[200] shadow-2xl rounded-b-2xl overflow-hidden"
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
              className={`block w-full text-right px-4 py-2.5 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
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
          {loading ? (
            <div className="grid grid-cols-3 gap-x-3 gap-y-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="w-full aspect-[3/4] rounded-lg bg-white/8 animate-pulse" />
                  <div className="h-2.5 w-3/4 rounded bg-white/8 animate-pulse" />
                </div>
              ))}
            </div>
          ) : games.length === 0 ? (
            <p className="text-white/30 text-sm pt-4">بازی‌ای در این دسته یافت نشد</p>
          ) : (
            <div className="grid grid-cols-3 gap-x-3 gap-y-4 items-start">
              {games.map((game) => (
                <Link
                  key={game.slug}
                  href={`/games/${game.slug}`}
                  onClick={onClose}
                  className="group flex flex-col gap-1.5"
                >
                  <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden ring-1 ring-white/15 transition-all duration-200 group-hover:ring-white/50 group-hover:scale-[1.03]">
                    {game.coverUrl ? (
                      <Image
                        src={game.coverUrl}
                        alt={game.title}
                        fill
                        className="object-cover"
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
                  <p className="text-white/65 text-[11px] font-medium truncate group-hover:text-white transition-colors text-center">
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
