"use client";

import { useMemo, useState } from "react";
import { Button, Pagination, SearchField } from "@heroui/react";
import GameCard from "./GameCard";
import PublisherFilter from "./PublisherFilter";
import SortBar, { type SortOption } from "./SortBar";
import { toPersianDigits } from "@/lib/format";
import type { GameSummary } from "@/lib/types";

const PAGE_SIZE = 20;

function getPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

export default function GameGrid({ games }: { games: GameSummary[] }) {
  const [query, setQueryRaw] = useState("");
  const [sort, setSortRaw] = useState<SortOption>("popular");
  const [selectedPublishers, setSelectedPublishersRaw] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  // Wrap setters so that changing filter/sort atomically resets to page 1
  const setQuery = (q: string) => { setQueryRaw(q); setPage(1); };
  const setSort = (s: SortOption) => { setSortRaw(s); setPage(1); };
  const setSelectedPublishers = (s: Set<string>) => { setSelectedPublishersRaw(s); setPage(1); };

  // Publishers with ≥ 2 games, sorted alphabetically — single-game publishers
  // are excluded as they add noise without useful filtering value.
  const publishersList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of games) {
      if (g.publisher) counts.set(g.publisher, (counts.get(g.publisher) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, n]) => n >= 2)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([pub]) => pub);
  }, [games]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter((g) => {
      if (q && !g.title.toLowerCase().includes(q) && !(g.genreLabel?.toLowerCase().includes(q) ?? false)) {
        return false;
      }
      if (selectedPublishers.size > 0 && (!g.publisher || !selectedPublishers.has(g.publisher))) {
        return false;
      }
      return true;
    });
  }, [games, query, selectedPublishers]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    if (sort === "newest") return copy.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === "price_asc") return copy.sort((a, b) => {
      if (a.lowestPriceToman === null) return 1;
      if (b.lowestPriceToman === null) return -1;
      return a.lowestPriceToman - b.lowestPriceToman;
    });
    if (sort === "price_desc") return copy.sort((a, b) => {
      if (a.lowestPriceToman === null) return 1;
      if (b.lowestPriceToman === null) return -1;
      return b.lowestPriceToman - a.lowestPriceToman;
    });
    if (sort === "popular") return copy.sort((a, b) => b.storeCount - a.storeCount);
    return filtered;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageNumbers = getPageNumbers(safePage, totalPages);

  const start = (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, sorted.length);

  return (
    <>
      <div className="mt-6 max-w-xl">
        <SearchField.Root value={query} onChange={setQuery} aria-label="جستجوی بازی" fullWidth>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="جستجوی بازی…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField.Root>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SortBar value={sort} onChange={setSort} />
          <PublisherFilter
            publishers={publishersList}
            selected={selectedPublishers}
            onChange={setSelectedPublishers}
          />
        </div>
        {sorted.length > 0 && (
          <p className="text-xs text-muted">
            نمایش {toPersianDigits(start)} تا {toPersianDigits(end)} از {toPersianDigits(sorted.length)} بازی
          </p>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted">بازی‌ای با این فیلترها پیدا نشد.</p>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => { setQuery(""); setSelectedPublishers(new Set()); }}
          >
            پاک کردن جستجو و فیلترها
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {paginated.map((game) => (
              <GameCard key={game.slug} game={game} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-10 flex justify-center">
              <Pagination aria-label="صفحه‌بندی بازی‌ها">
                <Pagination.Content>
                  <Pagination.Item>
                    <Pagination.Previous
                      onPress={() => setPage((p) => Math.max(1, p - 1))}
                      isDisabled={safePage === 1}
                    >
                      قبلی
                      <Pagination.NextIcon />
                    </Pagination.Previous>
                  </Pagination.Item>

                  {pageNumbers.map((num, idx) =>
                    num === "…" ? (
                      <Pagination.Item key={`ellipsis-${idx}`}>
                        <Pagination.Ellipsis />
                      </Pagination.Item>
                    ) : (
                      <Pagination.Item key={num}>
                        <Pagination.Link
                          isActive={num === safePage}
                          onPress={() => setPage(num)}
                        >
                          {toPersianDigits(num)}
                        </Pagination.Link>
                      </Pagination.Item>
                    )
                  )}

                  <Pagination.Item>
                    <Pagination.Next
                      onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                      isDisabled={safePage === totalPages}
                    >
                      <Pagination.PreviousIcon />
                      بعدی
                    </Pagination.Next>
                  </Pagination.Item>
                </Pagination.Content>
              </Pagination>
            </div>
          )}
        </>
      )}
    </>
  );
}
