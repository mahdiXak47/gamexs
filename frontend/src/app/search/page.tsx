import Link from "next/link";
import { Chip } from "@heroui/react";
import Header from "@/components/Header";
import GameGrid from "@/components/GameGrid";
import Disclaimer from "@/components/Disclaimer";
import { searchGames } from "@/lib/games-repo";
import { toPersianDigits } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const trimmed = q.trim();
  const games = trimmed.length >= 2 ? await searchGames(trimmed) : [];

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
            {games.length > 0 && (
              <Chip variant="solid" color="default" size="sm" classNames={{ base: "bg-white/20 text-white" }}>
                {toPersianDigits(games.length)} بازی
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

        {trimmed.length < 2 ? (
          <p className="text-gray-400 mt-8 text-center text-sm">
            حداقل ۲ کاراکتر برای جستجو وارد کنید
          </p>
        ) : games.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300" aria-hidden>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p className="text-gray-500 font-medium">نتیجه‌ای برای «{trimmed}» یافت نشد</p>
            <p className="text-sm text-gray-400">عنوان بازی را به انگلیسی امتحان کنید</p>
          </div>
        ) : (
          <GameGrid games={games} />
        )}
      </main>

      <Disclaimer />
    </>
  );
}
