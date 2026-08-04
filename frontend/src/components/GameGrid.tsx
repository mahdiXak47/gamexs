"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Pagination, SearchField } from "@heroui/react";
import GameCard from "./GameCard";
import PublisherFilter from "./PublisherFilter";
import SortBar from "./SortBar";
import { toPersianDigits } from "@/lib/format";
import type { GameSummary, SortOption } from "@/lib/types";

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

export default function GameGrid({
  games,
  total,
  page,
  pageSize,
  sort,
  query,
  selectedPublishers,
  publishersList,
  basePath,
}: {
  games: GameSummary[];
  total: number;
  page: number;
  pageSize: number;
  sort: SortOption;
  query: string;
  selectedPublishers: string[];
  publishersList: string[];
  basePath: string;
}) {
  const router = useRouter();
  const [queryInput, setQueryInput] = useState(query);

  // Keep the input in sync when navigation changes `query` externally
  // (e.g. browser back/forward), without fighting the user's own typing.
  useEffect(() => {
    setQueryInput(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Debounce search text before pushing a new URL (each change is a real
  // server round-trip now, unlike the old client-side-only filtering).
  useEffect(() => {
    if (queryInput === query) return;
    const t = setTimeout(() => updateParams({ q: queryInput || null, page: null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryInput]);

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sort !== "popular") params.set("sort", sort);
    if (selectedPublishers.length > 0) params.set("publisher", selectedPublishers.join(","));
    if (page > 1) params.set("page", String(page));

    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }

    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  const setSort = (s: SortOption) => updateParams({ sort: s === "popular" ? null : s, page: null });
  const setSelectedPublishers = (pubs: Set<string>) =>
    updateParams({ publisher: pubs.size > 0 ? [...pubs].join(",") : null, page: null });
  const setPage = (p: number) => updateParams({ page: p > 1 ? String(p) : null });
  const clearAll = () => {
    setQueryInput("");
    updateParams({ q: null, publisher: null, page: null });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageNumbers = getPageNumbers(page, totalPages);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const selectedSet = new Set(selectedPublishers);

  return (
    <>
      <div className="mt-6 max-w-xl">
        <SearchField.Root value={queryInput} onChange={setQueryInput} aria-label="جستجوی بازی" fullWidth>
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
          {publishersList.length > 0 && (
            <PublisherFilter
              publishers={publishersList}
              selected={selectedSet}
              onChange={setSelectedPublishers}
            />
          )}
        </div>
        {total > 0 && (
          <p className="text-xs text-gray-500">
            نمایش {toPersianDigits(start)} تا {toPersianDigits(end)} از {toPersianDigits(total)} بازی
          </p>
        )}
      </div>

      {total === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-gray-500">بازی‌ای با این فیلترها پیدا نشد.</p>
          <Button variant="ghost" size="sm" onPress={clearAll}>
            پاک کردن جستجو و فیلترها
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {games.map((game, i) => (
              <GameCard
                key={game.slug}
                game={game}
                isBestPrice={sort === "price_asc" && page === 1 && i === 0 && game.lowestPriceToman !== null}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-10 flex justify-center">
              <Pagination aria-label="صفحه‌بندی بازی‌ها">
                <Pagination.Content>
                  <Pagination.Item>
                    <Pagination.Previous
                      onPress={() => setPage(Math.max(1, page - 1))}
                      isDisabled={page === 1}
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
                          isActive={num === page}
                          onPress={() => setPage(num)}
                        >
                          {toPersianDigits(num)}
                        </Pagination.Link>
                      </Pagination.Item>
                    )
                  )}

                  <Pagination.Item>
                    <Pagination.Next
                      onPress={() => setPage(Math.min(totalPages, page + 1))}
                      isDisabled={page === totalPages}
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
