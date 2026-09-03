"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "./RemoteImage";
import { formatToman } from "@/lib/format";

interface SearchResult {
  slug: string;
  title: string;
  coverUrl: string | null;
  genreLabel: string | null;
  lowestPriceToman: number | null;
}

function useDebounce(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export default function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(-1);
  const [retryCount, setRetryCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLUListElement>(null);
  const debouncedQuery = useDebounce(query, 200);

  // Lock body scroll while overlay is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch results
  // Clear stale results as soon as the debounced query drops below the
  // minimum length (render-phase adjustment, not a synchronous effect
  // setState).
  const [prevDebounced, setPrevDebounced] = useState(debouncedQuery);
  if (prevDebounced !== debouncedQuery) {
    setPrevDebounced(debouncedQuery);
    if (debouncedQuery.length < 2) {
      setResults([]);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
  }

  useEffect(() => {
    if (debouncedQuery.length < 2) return;
    const controller = new AbortController();

    async function loadResults() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("search_failed");
        const data = await response.json();
        setResults(Array.isArray(data) ? data : []);
        setFocused(-1);
      } catch {
        if (controller.signal.aborted) return;
        setError("جستجو موقتاً در دسترس نیست. اتصال را بررسی کنید یا دوباره تلاش کنید.");
        setResults([]);
        setFocused(-1);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadResults();
    return () => controller.abort();
  }, [debouncedQuery, retryCount]);

  // Keyboard navigation
  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocused((f) => Math.min(f + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocused((f) => Math.max(f - 1, -1));
      } else if (e.key === "Enter" && focused >= 0) {
        e.preventDefault();
        const item = results[focused];
        if (item) { onClose(); window.location.href = `/games/${item.slug}`; }
      }
    },
    [results, focused, onClose]
  );

  const showResults = results.length > 0 && query.length >= 2;
  const showError = !loading && !!error && query.length >= 2;
  const showNoResults = !loading && !error && query.length >= 2 && results.length === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="ui-opacity-enter fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel — sits just below the header */}
      <div
        className="ui-popover-panel fixed top-[60px] inset-x-0 z-50 px-4 sm:px-6"
        role="dialog"
        aria-modal="true"
        aria-label="جستجو"
        onKeyDown={handleKey}
      >
        <div className="mx-auto max-w-3xl">

          {/* Search bar — PlayStation.com style */}
          <div className="flex items-stretch overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
            {/* Brand label */}
            <div className="hidden sm:flex items-center gap-2 bg-ps-blue px-5 border-l border-gray-200 shrink-0 select-none">
              <Image
                src="/logos/logo2.png"
                alt="GameXS"
                width={1024}
                height={1024}
                className="h-8 w-auto"
                priority
              />
            </div>

            {/* Input */}
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی بازی‌های PS5…"
              dir="rtl"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 bg-white px-5 py-4 text-base text-gray-900 placeholder:text-gray-400 outline-none [&::-webkit-search-cancel-button]:hidden"
              aria-label="جستجو"
              aria-autocomplete="list"
              aria-controls="search-results"
              aria-activedescendant={focused >= 0 ? `search-result-${focused}` : undefined}
              aria-invalid={showError}
            />

            {/* Search button */}
            <button
              onClick={() => inputRef.current?.focus()}
              aria-label="جستجو"
              className="cursor-pointer flex items-center justify-center w-14 shrink-0 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              style={{ background: "var(--color-ps-blue)" }}
            >
              {loading ? (
                <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              )}
            </button>
          </div>

          {/* Results dropdown */}
          {showResults && (
            <ul
              id="search-results"
              ref={resultsRef}
              role="listbox"
              aria-label="نتایج جستجو"
              className="ui-popover-panel mt-1 rounded-xl bg-white shadow-2xl ring-1 ring-black/10 divide-y divide-gray-100 overflow-y-auto max-h-[calc(100vh-120px)]"
            >
              {results.map((item, i) => (
                <li
                  key={item.slug}
                  id={`search-result-${i}`}
                  role="option"
                  aria-selected={i === focused}
                  className="ui-list-item"
                  style={{ animationDelay: `${Math.min(i, 8) * 24}ms` }}
                >
                  <Link
                    href={`/games/${item.slug}`}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors focus-visible:outline-none ${
                      i === focused ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                    dir="rtl"
                  >
                    {/* Cover thumbnail */}
                    <div className="relative w-10 h-14 shrink-0 rounded overflow-hidden bg-gray-100">
                      {item.coverUrl ? (
                        <Image src={item.coverUrl} alt="" fill className="object-cover" sizes="40px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-400">
                          {item.title.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p dir="auto" className="text-right text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                      {item.genreLabel && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.genreLabel}</p>
                      )}
                    </div>

                    {/* Price */}
                    {item.lowestPriceToman && (
                      <div className="shrink-0 text-left" dir="ltr">
                        <p className="text-[10px] text-gray-400 text-right">از</p>
                        <p className="text-sm font-bold text-gray-800 price-figure">
                          {formatToman(item.lowestPriceToman)}
                        </p>
                        <p className="text-[10px] text-gray-400 text-right">تومان</p>
                      </div>
                    )}

                    {/* Chevron */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 shrink-0" aria-hidden>
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </Link>
                </li>
              ))}

              {/* View all link */}
              <li role="option" aria-selected={false}>
                <Link
                  href={`/search?q=${encodeURIComponent(query)}`}
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-[var(--color-ps-blue)] hover:bg-blue-50 transition-colors"
                  dir="rtl"
                >
                  مشاهده همه نتایج برای «{query}»
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </Link>
              </li>
            </ul>
          )}

          {/* Search error */}
          {showError && (
            <div className="ui-popover-panel mt-1 rounded-xl bg-white px-5 py-5 text-center text-sm shadow-2xl ring-1 ring-black/10" role="alert">
              <p className="font-semibold text-gray-700">{error}</p>
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="mt-3 inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg bg-blue-50 px-4 text-xs font-bold text-ps-blue transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue"
              >
                تلاش دوباره
              </button>
            </div>
          )}

          {/* No results */}
          {showNoResults && (
            <div className="ui-popover-panel mt-1 rounded-xl bg-white px-5 py-6 text-center text-sm text-gray-400 shadow-2xl ring-1 ring-black/10">
              نتیجه‌ای برای «{query}» یافت نشد
            </div>
          )}
        </div>
      </div>
    </>
  );
}
