"use client";

import { useMemo, useState } from "react";
import GameCard from "./GameCard";
import type { Game } from "@/lib/types";

export default function GameGrid({
  games,
  covers,
}: {
  games: Game[];
  covers: Record<string, string | null>;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return games;
    return games.filter(
      (g) => g.title.toLowerCase().includes(q) || g.genreLabel.includes(q)
    );
  }, [games, query]);

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

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((game) => (
          <GameCard key={game.slug} game={game} coverUrl={covers[game.slug]} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted">بازی‌ای با این عنوان پیدا نشد.</p>
      )}
    </>
  );
}
