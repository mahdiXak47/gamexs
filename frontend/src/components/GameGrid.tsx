"use client";

import { useEffect, useState, useTransition } from "react";
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

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  );
}

function CatalogEmptyState({
  hasFilters,
  onClear,
  isPending,
}: {
  hasFilters: boolean;
  onClear: () => void;
  isPending: boolean;
}) {
  return (
    <div className="mt-10 flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-ps-blue" aria-hidden>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-700">
          {hasFilters ? "بازی‌ای با این جستجو یا فیلتر پیدا نشد." : "فعلاً بازی قابل نمایشی در این بخش نیست."}
        </p>
        <p className="mt-1 text-xs leading-6 text-gray-400">
          {hasFilters ? "عنوان را ساده‌تر وارد کنید یا فیلترهای انتخاب‌شده را پاک کنید." : "بعد از به‌روزرسانی قیمت فروشندگان، بازی‌ها در اینجا نمایش داده می‌شوند."}
        </p>
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" onPress={onClear} isDisabled={isPending}>
          پاک کردن جستجو و فیلترها
        </Button>
      )}
    </div>
  );
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
  const [isPending, startTransition] = useTransition();
  const [queryInput, setQueryInput] = useState(query);

  // Keep the input in sync when navigation changes `query` externally
  // (e.g. browser back/forward), without fighting the user's own typing.
  // Adjusting state during render (not in an effect) avoids the
  // react-hooks/set-state-in-effect warning.
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setQueryInput(query);
  }

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
    startTransition(() => {
      router.push(qs ? `${basePath}?${qs}` : basePath);
    });
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
  const hasActiveFilters = query.trim().length > 0 || selectedPublishers.length > 0;

  return (
    <>
      <div className="mt-6 w-full min-w-0 sm:max-w-xl">
        <SearchField.Root
          value={queryInput}
          onChange={setQueryInput}
          aria-label="جستجوی بازی"
          fullWidth
          isDisabled={isPending}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="جستجوی بازی…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField.Root>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {isPending ? "در حال به‌روزرسانی نتایج" : ""}
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <SortBar value={sort} onChange={setSort} isDisabled={isPending} />
          {publishersList.length > 0 && (
            <PublisherFilter
              publishers={publishersList}
              selected={selectedSet}
              onChange={setSelectedPublishers}
              isDisabled={isPending}
            />
          )}
        </div>
        {total > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {isPending && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 font-medium text-ps-blue">
                <LoadingSpinner />
                به‌روزرسانی
              </span>
            )}
            <p>
              نمایش {toPersianDigits(start)} تا {toPersianDigits(end)} از {toPersianDigits(total)} بازی
            </p>
          </div>
        )}
      </div>

      {total === 0 ? (
        <CatalogEmptyState hasFilters={hasActiveFilters} onClear={clearAll} isPending={isPending} />
      ) : (
        <div className="relative" aria-busy={isPending}>
          <div
            key={`${basePath}-${query}-${sort}-${page}-${selectedPublishers.join("|")}`}
            className={`mt-6 grid min-w-0 grid-cols-[repeat(2,minmax(0,1fr))] gap-3 transition-opacity duration-150 sm:gap-5 md:grid-cols-[repeat(3,minmax(0,1fr))] lg:grid-cols-[repeat(4,minmax(0,1fr))] ${
              isPending ? "opacity-55" : "opacity-100"
            }`}
          >
            {games.map((game, i) => (
              <div
                key={game.slug}
                className="ui-stagger-card h-full min-w-0"
                style={{ animationDelay: `${Math.min(i, 11) * 28}ms` }}
              >
                <GameCard
                  game={game}
                  isBestPrice={sort === "price_asc" && page === 1 && i === 0 && game.lowestPriceToman !== null}
                />
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-10 flex justify-center">
              <Pagination aria-label="صفحه‌بندی بازی‌ها">
                <Pagination.Content>
                  <Pagination.Item>
                    <Pagination.Previous
                      onPress={() => setPage(Math.max(1, page - 1))}
                      isDisabled={page === 1 || isPending}
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
                          isDisabled={isPending}
                        >
                          {toPersianDigits(num)}
                        </Pagination.Link>
                      </Pagination.Item>
                    )
                  )}

                  <Pagination.Item>
                    <Pagination.Next
                      onPress={() => setPage(Math.min(totalPages, page + 1))}
                      isDisabled={page === totalPages || isPending}
                    >
                      <Pagination.PreviousIcon />
                      بعدی
                    </Pagination.Next>
                  </Pagination.Item>
                </Pagination.Content>
              </Pagination>
            </div>
          )}
          {isPending && (
            <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/95 px-4 py-2 text-xs font-bold text-ps-blue shadow-lg shadow-slate-900/10 backdrop-blur">
                <LoadingSpinner />
                در حال به‌روزرسانی نتایج
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
