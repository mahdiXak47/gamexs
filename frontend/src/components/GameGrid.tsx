"use client";

import { useMemo, useState } from "react";
import GameCard from "./GameCard";
import SortBar, { type SortOption } from "./SortBar";
import type { GameSummary } from "@/lib/types";

export default function GameGrid({
  games,
  covers,
}: {
  games: GameSummary[];
  covers: Record<string, string | null>;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("popular");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return games;
    return games.filter(
      (g) => g.title.toLowerCase().includes(q) || (g.genreLabel?.toLowerCase().includes(q) ?? false)
    );
  }, [games, query]);

  const sorted = useMemo(() => {
    // "popular"/"price_asc"/"price_desc" are UI-only for now — popularity
    // ranking and price sorting need more thought before shipping, so they
    // leave the list in its existing (title) order. Only "newest" is wired
    // up, since it's a plain sort on a column we already have.
    if (sort === "newest") return [...filtered].sort((a, b) => b.createdAt - a.createdAt);
    return filtered;
  }, [filtered, sort]);

  return (
    <>
      <div className="relative mt-6 max-w-xl">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="text"
          placeholder="جستجوی بازی…"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 pr-10 text-sm outline-none focus:border-accent"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">⌕</span>
      </div>

      <div className="mt-4">
        <SortBar value={sort} onChange={setSort} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {sorted.map((game) => (
          <GameCard key={game.slug} game={game} coverUrl={covers[game.slug]} />
        ))}
      </div>

      {sorted.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted">بازی‌ای با این عنوان پیدا نشد.</p>
      )}
    </>
  );
}
