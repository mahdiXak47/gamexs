import type { MetadataRoute } from "next";
import { getLastScrapedAt, listGames } from "@/lib/games-repo";
import { GENRES } from "@/lib/genres";
import { TIER_SLUG } from "@/lib/ps-plus-repo";
import { SITE_URL } from "@/lib/seo";

// Regenerate hourly rather than per-request — matches the scraper's refresh
// cadence (data is a few hours stale anyway, see CLAUDE.md), so there's no
// value in recomputing this on every crawl hit.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [games, lastScrapedAt] = await Promise.all([listGames(), getLastScrapedAt()]);
  const lastModified = lastScrapedAt ?? new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/upcoming`, lastModified, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/ps-plus`, lastModified, changeFrequency: "daily", priority: 0.8 },
  ];

  const genreRoutes: MetadataRoute.Sitemap = GENRES.map((g) => ({
    url: `${SITE_URL}/genres/${g.slug}`,
    lastModified,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const psPlusRoutes: MetadataRoute.Sitemap = Object.values(TIER_SLUG).map((slug) => ({
    url: `${SITE_URL}/ps-plus/${slug}`,
    lastModified,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const gameRoutes: MetadataRoute.Sitemap = games.map((game) => ({
    url: `${SITE_URL}/games/${game.slug}`,
    lastModified,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...staticRoutes, ...genreRoutes, ...psPlusRoutes, ...gameRoutes];
}
