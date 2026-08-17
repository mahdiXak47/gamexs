import Link from "next/link";
import { Chip } from "@heroui/react";
import Header from "@/components/Header";
import GameGrid from "@/components/GameGrid";
import Disclaimer from "@/components/Disclaimer";
import { listGamesPage, listPublishers } from "@/lib/games-repo";
import { toPersianDigits } from "@/lib/format";
import { parseGameListSearchParams } from "@/lib/search-params";

const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";

// Query-driven results — noindex avoids thin/duplicate pages competing with
// the canonical /games/[slug] pages for the same content.
export const metadata = {
  robots: { index: false, follow: true },
};

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function SearchPrompt({
  defaultValue,
  title,
  description,
  actionLabel,
}: {
  defaultValue: string;
  title: string;
  description: string;
  actionLabel: string;
}) {
  return (
    <section dir="rtl" className="mx-auto mt-10 max-w-2xl rounded-2xl border border-gray-200 bg-white px-5 py-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-ps-blue">
        <SearchIcon />
      </div>
      <h2 className="mt-4 text-lg font-extrabold text-gray-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-gray-500">{description}</p>

      <form action="/search" className="mt-6 flex flex-col gap-3 sm:flex-row" role="search">
        <label htmlFor="search-page-query" className="sr-only">جستجوی بازی</label>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            id="search-page-query"
            name="q"
            type="search"
            defaultValue={defaultValue}
            minLength={2}
            placeholder="نام بازی را وارد کنید..."
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pr-10 pl-4 text-sm text-gray-900 outline-none transition focus:border-ps-blue focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl bg-ps-blue px-5 text-sm font-bold text-white transition-[background-color,transform] duration-150 hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue focus-visible:ring-offset-2"
        >
          {actionLabel}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs">
        {["GTA", "FC 26", "Spider-Man"].map((term) => (
          <Link
            key={term}
            href={`/search?q=${encodeURIComponent(term)}`}
            className="rounded-full border border-gray-200 px-3 py-1.5 font-medium text-gray-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-ps-blue"
          >
            {term}
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { query, sort, publishers, page } = parseGameListSearchParams(await searchParams);
  const trimmed = query.trim();
  const hasQuery = trimmed.length >= 2;

  const [{ games, total }, publishersList] = hasQuery
    ? await Promise.all([
        listGamesPage({ query: trimmed, sort, publishers, page, pageSize: PAGE_SIZE }),
        listPublishers(),
      ])
    : [{ games: [], total: 0 }, []];

  return (
    <>
      <Header />

      {/* Blue band — continuous with header */}
      <div className="ps-header">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
              {trimmed ? `نتایج «${trimmed}»` : "جستجو"}
            </h1>
            {total > 0 && (
              <Chip variant="soft" size="sm" className="bg-white/20 text-white">
                {toPersianDigits(total)} بازی
              </Chip>
            )}
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors"
            dir="rtl"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 18 6-6-6-6" />
            </svg>
            همه بازی‌ها
          </Link>
        </div>
      </div>

      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-8 sm:px-6">

        {!hasQuery ? (
          <SearchPrompt
            defaultValue={trimmed}
            title="جستجوی بازی‌های PS5"
            description="برای مقایسه قیمت، حداقل دو کاراکتر از نام بازی را وارد کنید یا یکی از پیشنهادها را انتخاب کنید."
            actionLabel="جستجو"
          />
        ) : total === 0 ? (
          <SearchPrompt
            defaultValue={trimmed}
            title={`نتیجه‌ای برای «${trimmed}» یافت نشد`}
            description="عنوان را ساده‌تر یا به انگلیسی وارد کنید. اگر بازی تازه معرفی شده باشد، ممکن است هنوز قیمت فروشنده‌ها برای آن ثبت نشده باشد."
            actionLabel="جستجوی دوباره"
          />
        ) : (
          <GameGrid
            games={games}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            sort={sort}
            query={query}
            selectedPublishers={publishers}
            publishersList={publishersList}
            basePath="/search"
          />
        )}
      </main>

      <Disclaimer />
    </>
  );
}
