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

      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6">

        {!hasQuery ? (
          <p className="text-gray-400 mt-8 text-center text-sm">
            حداقل ۲ کاراکتر برای جستجو وارد کنید
          </p>
        ) : total === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300" aria-hidden>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p className="text-gray-500 font-medium">نتیجه‌ای برای «{trimmed}» یافت نشد</p>
            <p className="text-sm text-gray-400">عنوان بازی را به انگلیسی امتحان کنید</p>
          </div>
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
