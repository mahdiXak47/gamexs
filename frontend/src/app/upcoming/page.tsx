import Link from "next/link";
import Image from "next/image";
import { Chip } from "@heroui/react";
import Header from "@/components/Header";
import CountdownTimer from "@/components/CountdownTimer";
import UpcomingHeroBanner from "@/components/UpcomingHeroBanner";
import { listAllUpcomingGames, getFeaturedUpcomingGames } from "@/lib/games-repo";
import { formatToman, toPersianDigits } from "@/lib/format";
import type { UpcomingGame } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "بازی‌های پیش‌خرید | GameXS",
  description: "لیست بازی‌های PS5 که هنوز منتشر نشده‌اند با تاریخ انتشار و شمارش معکوس",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const FA_MONTHS: Record<number, string> = {
  1: "فروردین", 2: "اردیبهشت", 3: "خرداد",
  4: "تیر",     5: "مرداد",    6: "شهریور",
  7: "مهر",     8: "آبان",     9: "آذر",
  10: "دی",     11: "بهمن",    12: "اسفند",
};

function persianMonthLabel(isoDate: string): string {
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date(isoDate));
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const monthName = FA_MONTHS[Number(m.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))))] ?? m;
  return `${monthName} ${toPersianDigits(y)}`;
}

function formatPersianDate(isoDate: string): string {
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(isoDate));
}

function groupByMonth(games: UpcomingGame[]): { label: string; isoMonth: string; games: UpcomingGame[] }[] {
  const map = new Map<string, UpcomingGame[]>();
  for (const g of games) {
    const key = g.releaseDate.slice(0, 7); // "YYYY-MM"
    const arr = map.get(key) ?? [];
    arr.push(g);
    map.set(key, arr);
  }
  return Array.from(map.entries()).map(([isoMonth, games]) => ({
    isoMonth,
    label: persianMonthLabel(isoMonth + "-01"),
    games,
  }));
}

// ── Game Card ─────────────────────────────────────────────────────────────────

function UpcomingCard({ game }: { game: UpcomingGame }) {
  const bg = game.keyArtUrl ?? game.coverUrl;

  return (
    <Link
      href={`/games/${game.slug}`}
      className="group relative overflow-hidden rounded-2xl flex flex-col justify-between min-h-[220px] focus-visible:outline-2 focus-visible:outline-white"
      aria-label={`${game.title} — پیش‌خرید`}
    >
      {/* Background */}
      {bg ? (
        <Image
          src={bg}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          aria-hidden
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/15 to-black/80 pointer-events-none" />

      {/* Top: title + date */}
      <div className="relative z-10 p-4">
        <h3 className="text-base font-bold text-white leading-snug drop-shadow line-clamp-2">
          {game.title}
        </h3>
        <p className="text-xs text-white/75 mt-1 underline underline-offset-2 decoration-white/35">
          {formatPersianDate(game.releaseDate)}
        </p>
      </div>

      {/* Bottom: countdown + meta */}
      <div className="relative z-10 p-4 flex flex-col gap-2">
        <CountdownTimer releaseDate={game.releaseDate} />
        <div className="flex items-center gap-2 flex-wrap">
          {game.lowestPriceToman && (
            <span className="text-xs text-white/60 price-figure">
              از {formatToman(game.lowestPriceToman)} تومان
            </span>
          )}
          <Chip size="sm" variant="soft" className="bg-white/10 text-white/70 text-[10px] h-5">
            {toPersianDigits(game.sellerCount)} فروشنده
          </Chip>
        </div>
      </div>
    </Link>
  );
}

// ── Month Group ───────────────────────────────────────────────────────────────

function MonthGroup({ label, games }: { label: string; games: UpcomingGame[] }) {
  return (
    <section aria-labelledby={`month-${label}`}>
      <div className="flex items-center gap-3 mb-4">
        <h2
          id={`month-${label}`}
          className="text-lg font-bold text-gray-800"
        >
          {label}
        </h2>
        <Chip size="sm" variant="soft" color="default" className="text-xs">
          {toPersianDigits(games.length)} بازی
        </Chip>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map((g) => (
          <UpcomingCard key={g.slug} game={g} />
        ))}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const FEATURED_SLUGS = [
  "grand-theft-auto-vi",
  "marvel’s-wolverine",
  "halo-campaign-evolved",
  "control-resonant",
  "call-of-duty-modern-warfare-4",
];

export default async function UpcomingPage() {
  const [games, featuredGames] = await Promise.all([
    listAllUpcomingGames(),
    getFeaturedUpcomingGames(FEATURED_SLUGS),
  ]);
  const groups = groupByMonth(games);

  return (
    <>
      <Header />

      {/* Hero carousel — featured upcoming games */}
      <UpcomingHeroBanner games={featuredGames} />

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 flex flex-col gap-10">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">بازی‌های پیش‌خرید</h1>
            <Chip variant="soft" color="accent" size="sm">PS5</Chip>
            {games.length > 0 && (
              <Chip variant="soft" color="default" size="sm">{toPersianDigits(games.length)} بازی</Chip>
            )}
          </div>
          <p className="text-sm text-gray-500">بازی‌هایی که هنوز منتشر نشده‌اند — مرتب‌شده بر اساس تاریخ انتشار</p>
        </div>

        {games.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">هیچ بازی پیش‌خریدی یافت نشد</p>
          </div>
        ) : (
          groups.map((group) => (
            <MonthGroup key={group.isoMonth} label={group.label} games={group.games} />
          ))
        )}
      </main>
    </>
  );
}
