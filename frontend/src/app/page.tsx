import { Chip } from "@heroui/react";
import Disclaimer from "@/components/Disclaimer";
import GameGrid from "@/components/GameGrid";
import GameRecommendations from "@/components/GameRecommendations";
import Header from "@/components/Header";
import HeroBanner from "@/components/HeroBanner";
import TopGames from "@/components/TopGames";
import UpcomingGames from "@/components/UpcomingGames";
import { getLastScrapedAt, getFeaturedUpcomingGames, listGames } from "@/lib/games-repo";

const HOMEPAGE_UPCOMING_SLUGS = [
  "call-of-duty-modern-warfare-4",
  "grand-theft-auto-vi",
  "control-resonant",
  "marvel’s-wolverine",
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const [games, lastScrapedAt, upcomingGames] = await Promise.all([
    listGames(),
    getLastScrapedAt(),
    getFeaturedUpcomingGames(HOMEPAGE_UPCOMING_SLUGS),
  ]);

  // Sort by popularity (storeCount) for featured/trending sections
  const byPopularity = [...games].sort((a, b) => b.storeCount - a.storeCount);
  const featuredGames = byPopularity.slice(0, 5); // hero carousel
  const topGames = byPopularity.slice(0, 10);     // top 10 section

  // Format last updated for display
  const lastUpdated = lastScrapedAt
    ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(lastScrapedAt)
    : null;

  return (
    <>
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
        <GameGrid games={games} />
      </main>

      <Disclaimer />
    </>
  );
}
