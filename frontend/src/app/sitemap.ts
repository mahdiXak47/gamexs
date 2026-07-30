import type { MetadataRoute } from "next";
import { getLastScrapedAt, listGames } from "@/lib/games-repo";
import { GENRES } from "@/lib/genres";
import { TIER_SLUG } from "@/lib/ps-plus-repo";
import { SITE_URL } from "@/lib/seo";

// force-dynamic (not revalidate/ISR) — every DB-backed route in this app is
// force-dynamic because the Docker build only sets a placeholder
// DATABASE_URL, expecting no route to touch the DB at build time. revalidate
// would make Next.js prerender this route during `next build`, which fails
// there (see frontend/Dockerfile).
export const dynamic = "force-dynamic";

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
