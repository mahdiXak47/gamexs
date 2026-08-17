"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { formatToman } from "@/lib/format";

interface Suggestion {
  slug: string;
  title: string;
  genreLabel: string | null;
  coverUrl: string | null;
}

interface Recommendation {
  aiName: string;
  aiDescription: string;
  slug: string | null;
  title: string;
  genreLabel: string | null;
  coverUrl: string | null;
  lowestPriceToman: number | null;
  storeCount: number;
  matched: boolean;
}

function resolveCoverUrl(url: string | null): string | null {
  if (!url) return null;
  if (!url.includes("gs3.gamexs.ir")) return null; // non-S3 URLs not served
  return url.replace(/^http:\/\//, "https://"); // optimizer needs HTTPS
}

function CoverFallback({ title }: { title: string }) {
  const initials = title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="w-full h-full flex items-center justify-center bg-ps-blue/10">
      <span className="text-ps-blue font-extrabold text-sm">{initials}</span>
    </div>
  );
}

function RecCard({ game, index }: { game: Recommendation; index: number }) {
  const src = resolveCoverUrl(game.coverUrl);
  const content = (
    <>
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-50">
        {src ? (
          <Image
            src={src}
            alt=""
            aria-hidden="true"
            fill
            sizes="(max-width: 640px) 50vw, 200px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <CoverFallback title={game.title} />
        )}
      </div>
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <p dir="auto" className="text-right text-xs font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-ps-blue transition-colors">
          {game.title}
        </p>
        {game.genreLabel && (
          <p className="text-[10px] text-ps-blue/70 font-medium truncate">
            {game.genreLabel}
          </p>
        )}
        {game.aiDescription && (
          <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-3">
            {game.aiDescription}
          </p>
        )}
        {game.lowestPriceToman !== null ? (
          <div className="mt-auto pt-2 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 mb-0.5">کمترین قیمت</p>
            <p className="text-xs text-emerald-600 font-bold price-figure">
              {formatToman(game.lowestPriceToman)}
              <span className="text-gray-400 font-normal text-[10px] mr-1">تومان</span>
            </p>
          </div>
        ) : (
          <p className="mt-auto pt-2 text-[10px] font-medium text-gray-400">
            قیمت فعالی پیدا نشد
          </p>
        )}
      </div>
    </>
  );

  const className = "ui-stagger-card group flex flex-col rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue";
  const style = { animationDelay: `${Math.min(index, 8) * 35}ms` };

  if (!game.slug) {
    return (
      <div className={`${className} opacity-80`} style={style} aria-label={`${game.title} در کاتالوگ پیدا نشد`}>
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/games/${game.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
    >
      {content}
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm animate-pulse">
      <div className="aspect-[3/4] bg-gray-200" />
      <div className="p-3 flex flex-col gap-2">
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-3/4" />
        <div className="h-2.5 bg-gray-100 rounded w-full mt-1" />
        <div className="h-2.5 bg-gray-100 rounded w-5/6" />
        <div className="h-3 bg-emerald-50 rounded w-1/2 mt-2" />
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="mt-8 flex flex-col items-center gap-4 py-6">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block w-2 h-2 rounded-full bg-ps-blue animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
      <p className="text-sm text-gray-500">در حال پیدا کردن بازی‌های متناسب با بازی مورد علاقه شما</p>
    </div>
  );
}

export default function GameRecommendations() {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [suggestError, setSuggestError] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setActiveIdx(-1);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Close EventSource on unmount
  useEffect(() => () => { esRef.current?.close(); }, []);

  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      setDropdownOpen(false);
      setSuggestError(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoadingSuggest(true);
      setSuggestError(false);
      try {
        const res = await fetch(`/api/find-similar-games?search=${encodeURIComponent(q.trim())}`);
        if (!res.ok) throw new Error("suggestions_failed");
        const data: Suggestion[] = await res.json();
        const items = Array.isArray(data) ? data : [];
        setSuggestions(items);
        setDropdownOpen(items.length > 0);
        setActiveIdx(-1);
      } catch {
        setSuggestions([]);
        setDropdownOpen(false);
        setSuggestError(true);
      } finally {
        setLoadingSuggest(false);
      }
    }, 300);
  }, []);

  const selectGame = useCallback((game: Suggestion) => {
    // Close any in-flight stream before starting a new one
    esRef.current?.close();

    setInput(game.title);
    setSelected(game);
    setSuggestions([]);
    setDropdownOpen(false);
    setActiveIdx(-1);
    setRecs([]);
    setAiError(false);
    setLoadingRecs(true);

    console.log(`[GameXS] جستجوی بازی‌های مشابه شروع شد — بازی انتخابی: "${game.title}" (slug: ${game.slug})`);
    const startTime = performance.now();

    const es = new EventSource(`/api/find-similar-games?game=${encodeURIComponent(game.slug)}`);
    esRef.current = es;

    es.onmessage = (e) => {
      if (e.data === "[DONE]") {
        es.close();
        esRef.current = null;
        setLoadingRecs(false);
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
        console.log(`[GameXS] پاسخ دریافت شد — زمان کل: ${elapsed} ثانیه`);
        return;
      }
      try {
        const item = JSON.parse(e.data as string) as Recommendation | { error: string };
        if ("error" in item) {
          es.close();
          esRef.current = null;
          setAiError(true);
          setLoadingRecs(false);
          return;
        }
        setRecs((prev) => [...prev, item as Recommendation]);
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setAiError(true);
      setLoadingRecs(false);
    };
  }, []);

  const retryRecommendations = useCallback(() => {
    if (selected) selectGame(selected);
  }, [selectGame, selected]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInput(v);
    setSelected(null);
    setRecs([]);
    setAiError(false);
    setSuggestError(false);
    fetchSuggestions(v);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      selectGame(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
      setActiveIdx(-1);
    }
  };

  return (
    <section
      className="py-10 px-4 sm:px-6 bg-gradient-to-b from-ps-blue-light/40 to-transparent"
      aria-labelledby="rec-section-heading"
    >
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="flex flex-col items-center gap-2 mb-6 text-center">
          <div className="text-ps-blue" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <h2 id="rec-section-heading" className="text-xl font-extrabold text-gray-900">
            مشاهده بازی‌های مطابق با سلیقه تو
          </h2>
          <p className="text-sm text-gray-500">
            یک بازی که بهترین تجربه رو برات داشته وارد کن. بازی‌های مشابه که همین تجربه رو برات می‌سازن برات می‌فرستیم
          </p>
        </div>

        {/* Search */}
        <div ref={wrapperRef} className="relative max-w-lg mx-auto">
          <label htmlFor="rec-game-input" className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
            نام یک بازی که دوستش داری را وارد کن
          </label>
          <div className="relative">
            <input
              id="rec-game-input"
              type="text"
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setDropdownOpen(true)}
              placeholder="مثلاً: God of War Ragnarök"
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls="rec-suggestions"
              aria-expanded={dropdownOpen}
              aria-invalid={suggestError}
              role="combobox"
              className="w-full h-12 rounded-xl border border-gray-200 bg-white px-4 pl-11 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ps-blue/40 focus:border-ps-blue transition-colors"
            />
            <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
              {loadingSuggest ? (
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/>
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
              )}
            </div>
          </div>

          {/* Autocomplete dropdown */}
          {dropdownOpen && suggestions.length > 0 && (
            <ul
              id="rec-suggestions"
              role="listbox"
              aria-label="پیشنهادهای جستجو"
              className="ui-popover-panel absolute z-50 top-full mt-1.5 w-full rounded-xl border border-gray-100 bg-white shadow-xl overflow-hidden"
            >
              {suggestions.map((s, i) => {
                const src = resolveCoverUrl(s.coverUrl);
                return (
                  <li
                    key={s.slug}
                    role="option"
                    aria-selected={i === activeIdx}
                    className="ui-list-item"
                    style={{ animationDelay: `${Math.min(i, 8) * 24}ms` }}
                  >
                    <button
                      type="button"
                      onClick={() => selectGame(s)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-right transition-colors ${
                        i === activeIdx ? "bg-ps-blue/10" : "hover:bg-ps-blue/5"
                      }`}
                    >
                      <div className="relative w-8 h-10 rounded overflow-hidden bg-gray-100 shrink-0">
                        {src ? (
                          <Image src={src} alt="" fill sizes="40px" className="object-cover" />
                        ) : (
                          <CoverFallback title={s.title} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
                        {s.genreLabel && (
                          <p className="text-xs text-gray-500 truncate">{s.genreLabel}</p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {suggestError && (
          <div className="mx-auto mt-3 max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs leading-6 text-amber-800" role="alert">
            جستجوی پیشنهادها موقتاً انجام نشد.
            <button
              type="button"
              onClick={() => fetchSuggestions(input)}
              className="mr-2 cursor-pointer font-bold text-amber-900 underline underline-offset-4"
            >
              تلاش دوباره
            </button>
          </div>
        )}

        {/* Error */}
        {aiError && (
          <div className="mt-8 rounded-xl bg-red-50 border border-red-100 px-6 py-8 text-center">
            <p className="text-red-500 text-sm font-medium">خطا در دریافت پیشنهادات</p>
            <p className="text-gray-400 text-xs mt-1">لطفاً دوباره امتحان کن</p>
            <button
              type="button"
              onClick={retryRecommendations}
              disabled={!selected}
              className="mt-4 inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg bg-red-100 px-4 text-xs font-bold text-red-700 transition-colors hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              تلاش دوباره
            </button>
          </div>
        )}

        {/* Streaming results — cards appear one by one as AI responds */}
        {!aiError && selected && (recs.length > 0 || loadingRecs) && (
          <div className="mt-8">
            {recs.length === 0 && loadingRecs && <ThinkingDots />}
            {recs.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {recs.map((rec, index) => (
                  <RecCard key={rec.aiName} game={rec} index={index} />
                ))}
                {/* Skeleton slots for cards still arriving */}
                {loadingRecs && Array.from({ length: 5 - recs.length }).map((_, i) => (
                  <div
                    key={`skel-${i}`}
                    className="ui-stagger-card"
                    style={{ animationDelay: `${Math.min(recs.length + i, 8) * 35}ms` }}
                  >
                    <SkeletonCard />
                  </div>
                ))}
              </div>
            )}
            {!loadingRecs && recs.length > 0 && (
              <p className="text-[10px] text-gray-400 text-center mt-4">
                کلیک روی هر کارت صفحه بازی را در تب جدید باز می‌کند
              </p>
            )}
          </div>
        )}

        {/* Empty — stream finished with no results */}
        {!aiError && !loadingRecs && selected && recs.length === 0 && (
          <div className="mt-8 rounded-xl bg-white border border-gray-100 px-6 py-10 text-center">
            <p className="text-gray-500 text-sm">بازی مشابهی برای «{selected.title}» پیدا نشد.</p>
            <p className="text-gray-400 text-xs mt-1">بازی دیگری را امتحان کن</p>
          </div>
        )}

      </div>
    </section>
  );
}
