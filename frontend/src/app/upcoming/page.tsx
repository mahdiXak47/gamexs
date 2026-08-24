import Link from "next/link";
import Image from "next/image";
import { Chip } from "@heroui/react";
import Breadcrumb from "@/components/Breadcrumb";
import Header from "@/components/Header";
import CountdownTimer from "@/components/CountdownTimer";
import HeroBanner from "@/components/HeroBanner";
import JsonLd from "@/components/JsonLd";
import { listAllUpcomingGames, getFeaturedUpcomingGames } from "@/lib/games-repo";
import { formatToman, toPersianDigits } from "@/lib/format";
import { breadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import type { GameSummary, UpcomingGame } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "بازی‌های پیش‌خرید",
  description: "لیست بازی‌های PS5 که هنوز منتشر نشده‌اند با تاریخ انتشار و شمارش معکوس",
  alternates: { canonical: "/upcoming" },
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

function upcomingToHeroGame(game: UpcomingGame): GameSummary {
  return {
    slug: game.slug,
    title: game.title,
    genreLabel: "پیش‌خرید",
    publisher: null,
    coverInitial: game.title.trim().slice(0, 2).toUpperCase() || "?",
    coverUrl: game.coverUrl,
    mainBackgroundImageUrl: game.mainBackgroundImageUrl,
    screenshotUrl: null,
    lowestPriceToman: game.lowestPriceToman,
    lowestPriceLabel: null,
    heroPriceOptions: [],
    storeCount: game.sellerCount,
    purchaseTypeCount: 1,
    createdAt: new Date(game.releaseDate).getTime(),
  };
}

function EmptyUpcomingState() {
  return (
    <section className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center shadow-sm" dir="rtl">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-ps-blue" aria-hidden>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v4M16 2v4M3 10h18" />
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="m9 16 2 2 4-5" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-extrabold text-gray-900">فعلاً بازی پیش‌خریدی برای نمایش نداریم</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-gray-500">
        وقتی فروشنده‌ها قیمت پیش‌خرید یا تاریخ انتشار تازه ثبت کنند، بازی‌ها در همین بخش گروه‌بندی می‌شوند.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-ps-blue px-5 text-sm font-bold text-white transition-[background-color,transform] duration-150 hover:bg-blue-700 active:scale-[0.98]"
        >
          مشاهده همه بازی‌ها
        </Link>
        <Link
          href="/search"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-200 px-5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
        >
          جستجوی بازی
        </Link>
      </div>
    </section>
  );
}

function FeaturedDegradedNotice() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800" dir="rtl" role="status">
      بخش بازی‌های ویژه موقتاً کامل نیست، اما فهرست پیش‌خریدها در دسترس است.
    </div>
  );
}

// ── Game Card ─────────────────────────────────────────────────────────────────

function UpcomingCard({ game }: { game: UpcomingGame }) {
  const bg = game.mainBackgroundImageUrl ?? game.coverUrl;

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
        <h3 dir="auto" className="text-right text-base font-bold text-white leading-snug drop-shadow line-clamp-2">
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

export default async function UpcomingPage() {
  const [gamesResult, featuredGamesResult] = await Promise.allSettled([
    listAllUpcomingGames(),
    getFeaturedUpcomingGames(6),
  ]);
  if (gamesResult.status === "rejected") throw gamesResult.reason;

  const games = gamesResult.value;
  const featuredGames = featuredGamesResult.status === "fulfilled" ? featuredGamesResult.value : [];
  const featuredFailed = featuredGamesResult.status === "rejected";
  if (featuredFailed) {
    console.error("Upcoming featured games failed", featuredGamesResult.reason);
  }

  const groups = groupByMonth(games);
  const heroGames = featuredGames.map(upcomingToHeroGame);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: games.map((game, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/games/${game.slug}`,
      name: game.title,
    })),
  };
  const breadcrumbItems = [
    { label: "بازی‌های PS5", href: "/" },
    { label: "بازی‌های پیش‌خرید" },
  ];
  const breadcrumbSchema = breadcrumbJsonLd([
    { name: "بازی‌های PS5", path: "/" },
    { name: "بازی‌های پیش‌خرید", path: "/upcoming" },
  ]);

  return (
    <>
      {games.length > 0 && <JsonLd data={itemListJsonLd} />}
      <JsonLd data={breadcrumbSchema} />
      <Header />

      {heroGames.length > 0 && (
        <HeroBanner
          games={heroGames}
          copy={{
            ariaLabel: "بازی‌های پیش‌خرید ویژه",
            badge: "پیش‌خرید",
            cta: "مشاهده پیش‌خرید",
            pricePrefix: "پیش‌خرید از",
          }}
        />
      )}

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 flex flex-col gap-10">
        <div>
          <div className="mb-4">
            <Breadcrumb items={breadcrumbItems} />
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">بازی‌های پیش‌خرید</h1>
            <Chip variant="soft" color="accent" size="sm">PS5</Chip>
            {games.length > 0 && (
              <Chip variant="soft" color="default" size="sm">{toPersianDigits(games.length)} بازی</Chip>
            )}
          </div>
          <p className="text-sm text-gray-500">بازی‌هایی که هنوز منتشر نشده‌اند — مرتب‌شده بر اساس تاریخ انتشار</p>
        </div>

        {featuredFailed && <FeaturedDegradedNotice />}

        {games.length === 0 ? (
          <EmptyUpcomingState />
        ) : (
          groups.map((group) => (
            <MonthGroup key={group.isoMonth} label={group.label} games={group.games} />
          ))
        )}
      </main>
    </>
  );
}
