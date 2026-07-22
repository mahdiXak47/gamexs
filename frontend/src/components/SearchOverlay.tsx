"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
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
  const [focused, setFocused] = useState(-1);
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
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) { setResults(data); setFocused(-1); } })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel — sits just below the header */}
      <div
        className="fixed top-[60px] inset-x-0 z-50 px-4 sm:px-6"
        role="dialog"
        aria-modal="true"
        aria-label="جستجو"
        onKeyDown={handleKey}
      >
        <div className="mx-auto max-w-3xl">

          {/* Search bar — PlayStation.com style */}
          <div className="flex items-stretch overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
            {/* Brand label */}
            <div className="hidden sm:flex items-center gap-2 bg-white px-5 border-l border-gray-200 shrink-0 select-none">
              <span className="text-sm font-bold text-gray-800 whitespace-nowrap">Game<span className="text-yellow-500">XS</span></span>
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
              className="mt-1 rounded-xl bg-white shadow-2xl ring-1 ring-black/10 divide-y divide-gray-100 overflow-y-auto max-h-[calc(100vh-120px)]"
            >
              {results.map((item, i) => (
                <li
                  key={item.slug}
                  id={`search-result-${i}`}
                  role="option"
                  aria-selected={i === focused}
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
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
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

          {/* No results */}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="mt-1 rounded-xl bg-white px-5 py-6 text-center text-sm text-gray-400 shadow-2xl ring-1 ring-black/10">
              نتیجه‌ای برای «{query}» یافت نشد
            </div>
          )}
        </div>
      </div>
    </>
  );
}
