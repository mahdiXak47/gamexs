"use client";

import { useEffect, useTransition } from "react";
import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Pagination } from "@heroui/react";
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
  title,
  description,
}: {
  hasFilters: boolean;
  onClear: () => void;
  isPending: boolean;
  title?: string;
  description?: string;
}) {
  const emptyTitle = title ?? (hasFilters ? "بازی‌ای با این جستجو یا فیلتر پیدا نشد." : "فعلاً بازی قابل نمایشی در این بخش نیست.");
  const emptyDescription = description ?? (hasFilters ? "عنوان را ساده‌تر وارد کنید یا فیلترهای انتخاب‌شده را پاک کنید." : "بعد از به‌روزرسانی قیمت فروشندگان، بازی‌ها در اینجا نمایش داده می‌شوند.");

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
          {emptyTitle}
        </p>
        <p className="mt-1 text-xs leading-6 text-gray-400">
          {emptyDescription}
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
  emptyTitle,
  emptyDescription,
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
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const didMount = useRef(false);
  const selectedPublishersKey = selectedPublishers.join(",");

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    document.getElementById("main-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page, query, sort, selectedPublishersKey]);

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
      router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    });
  }

  const setSort = (s: SortOption) => updateParams({ sort: s === "popular" ? null : s, page: null });
  const setSelectedPublishers = (pubs: Set<string>) =>
    updateParams({ publisher: pubs.size > 0 ? [...pubs].join(",") : null, page: null });
  const clearAll = () => updateParams({ q: null, publisher: null, page: null });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageNumbers = getPageNumbers(page, totalPages);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const selectedSet = new Set(selectedPublishers);
  const hasActiveFilters = query.trim().length > 0 || selectedPublishers.length > 0;
  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sort !== "popular") params.set("sort", sort);
    if (selectedPublishers.length > 0) params.set("publisher", selectedPublishers.join(","));
    if (targetPage > 1) params.set("page", String(targetPage));
    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        {isPending ? "در حال به‌روزرسانی نتایج" : ""}
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <SortBar
            value={sort}
            onChange={setSort}
            isDisabled={isPending}
            publisherFilter={publishersList.length > 0 ? (
              <PublisherFilter
                publishers={publishersList}
                selected={selectedSet}
                onChange={setSelectedPublishers}
                isDisabled={isPending}
              />
            ) : undefined}
          />
          {publishersList.length > 0 && (
            <div className="sm:hidden">
              <PublisherFilter
                publishers={publishersList}
                selected={selectedSet}
                onChange={setSelectedPublishers}
                isDisabled={isPending}
              />
            </div>
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
        <CatalogEmptyState
          hasFilters={hasActiveFilters}
          onClear={clearAll}
          isPending={isPending}
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <div className="relative" aria-busy={isPending}>
          <div
            key={`${basePath}-${query}-${sort}-${page}-${selectedPublishers.join("|")}`}
            className={`mt-6 grid min-w-0 grid-cols-[repeat(2,minmax(0,1fr))] gap-3 transition-opacity duration-150 sm:gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))] lg:grid-cols-5 xl:grid-cols-7 ${
              isPending ? "opacity-55" : "opacity-100"
            }`}
            dir="ltr"
          >
            {games.map((game, i) => (
              <div
                key={game.slug}
                className="ui-stagger-card h-full min-w-0"
                style={{ animationDelay: `${Math.min(i, 11) * 28}ms` }}
                dir="rtl"
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
                    <Link
                      href={pageHref(Math.max(1, page - 1))}
                      scroll={false}
                      aria-disabled={page === 1 || isPending}
                      tabIndex={page === 1 || isPending ? -1 : undefined}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-100 aria-disabled:pointer-events-none aria-disabled:opacity-40"
                    >
                      قبلی
                      <Pagination.NextIcon />
                    </Link>
                  </Pagination.Item>

                  {pageNumbers.map((num, idx) =>
                    num === "…" ? (
                      <Pagination.Item key={`ellipsis-${idx}`}>
                        <Pagination.Ellipsis />
                      </Pagination.Item>
                    ) : (
                      <Pagination.Item key={num}>
                        <Link
                          href={pageHref(num)}
                          scroll={false}
                          aria-current={num === page ? "page" : undefined}
                          aria-disabled={isPending}
                          tabIndex={isPending ? -1 : undefined}
                          className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-bold transition hover:bg-blue-50 hover:text-ps-blue aria-disabled:pointer-events-none aria-disabled:opacity-40 ${num === page ? "bg-ps-blue text-white hover:bg-ps-blue hover:text-white" : "text-gray-600"}`}
                        >
                          {toPersianDigits(num)}
                        </Link>
                      </Pagination.Item>
                    )
                  )}

                  <Pagination.Item>
                    <Link
                      href={pageHref(Math.min(totalPages, page + 1))}
                      scroll={false}
                      aria-disabled={page === totalPages || isPending}
                      tabIndex={page === totalPages || isPending ? -1 : undefined}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-100 aria-disabled:pointer-events-none aria-disabled:opacity-40"
                    >
                      <Pagination.PreviousIcon />
                      بعدی
                    </Link>
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
