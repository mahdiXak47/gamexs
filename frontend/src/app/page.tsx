import { Chip } from "@heroui/react";
import Disclaimer from "@/components/Disclaimer";
import GameGrid from "@/components/GameGrid";
import GameRecommendations from "@/components/GameRecommendations";
import Header from "@/components/Header";
import HeroBanner from "@/components/HeroBanner";
import JsonLd from "@/components/JsonLd";
import TopGames from "@/components/TopGames";
import UpcomingGames from "@/components/UpcomingGames";
import { getLastScrapedAt, getFeaturedUpcomingGames, listGamesPage, listPublishers } from "@/lib/games-repo";
import { parseGameListSearchParams } from "@/lib/search-params";
import { SITE_URL } from "@/lib/seo";

const HOMEPAGE_UPCOMING_SLUGS = [
  "call-of-duty-modern-warfare-4",
  "grand-theft-auto-vi",
  "control-resonant--1",
  "marvels-wolverine",
];

const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { query, sort, publishers, page } = parseGameListSearchParams(await searchParams);

  const [{ games: topGames }, { games, total }, publishersList, lastScrapedAt, upcomingGames] = await Promise.all([
    listGamesPage({ sort: "popular", pageSize: 10, onlyWithListings: true }),
    listGamesPage({ query, sort, publishers, page, pageSize: PAGE_SIZE, onlyWithListings: true }),
    listPublishers(),
    getLastScrapedAt(),
    getFeaturedUpcomingGames(HOMEPAGE_UPCOMING_SLUGS),
  ]);

  const featuredGames = topGames.slice(0, 5); // hero carousel

  // Format last updated for display
  const lastUpdated = lastScrapedAt
    ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(lastScrapedAt)
    : null;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: topGames.map((game, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/games/${game.slug}`,
      name: game.title,
    })),
  };

  return (
    <>
      {topGames.length > 0 && <JsonLd data={itemListJsonLd} />}
      <Header />

      {/* Hero Banner */}
      <HeroBanner games={featuredGames} />

      {/* Game Recommendations */}
      <GameRecommendations />

      {/* Top 10 Trending */}
      <TopGames games={topGames} />

      {/* Upcoming / Pre-order */}
      <UpcomingGames games={upcomingGames} />

      {/* Divider */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="border-t border-gray-200" />
      </div>

      {/* Full Games Catalog */}
      <main id="main-content" className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
            همه بازی‌ها
          </h1>
          <Chip variant="soft" color="accent" size="sm">PS5</Chip>
        </div>
        <p className="text-sm text-gray-500 mb-1">
          مقایسه قیمت در فروشندگان معتبر ایران
        </p>
        {lastUpdated && (
          <p className="text-xs text-gray-400 mb-6">
            آخرین به‌روزرسانی: {lastUpdated}
          </p>
        )}
        <GameGrid
          games={games}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          sort={sort}
          query={query}
          selectedPublishers={publishers}
          publishersList={publishersList}
          basePath="/"
        />
      </main>

      <Disclaimer />
    </>
  );
}
