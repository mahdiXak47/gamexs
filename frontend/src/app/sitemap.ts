import type { MetadataRoute } from "next";
import { getLastScrapedAt, listCatalogAvailability, listPublisherRoutes, listSitemapGames } from "@/lib/games-repo";
import { GENRES } from "@/lib/genres";
import { getAllPsPlusPlans, TIER_SLUG } from "@/lib/ps-plus-repo";
import { PURCHASE_TYPE_PAGES } from "@/lib/purchase-type-pages";
import { SITE_URL } from "@/lib/seo";
import { TRUST_PAGES } from "@/lib/trust-pages";

// force-dynamic (not revalidate/ISR) — every DB-backed route in this app is
// force-dynamic because the Docker build only sets a placeholder
// DATABASE_URL, expecting no route to touch the DB at build time. revalidate
// would make Next.js prerender this route during `next build`, which fails
// there (see frontend/Dockerfile).
export const dynamic = "force-dynamic";

function lastModifiedField(lastModified: Date | null | undefined) {
  return lastModified ? { lastModified } : {};
}

function canonicalSitemapUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.protocol = "https:";
  url.hostname = new URL(SITE_URL).hostname;
  url.port = "";
  url.search = "";
  url.hash = "";
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function deduplicateSitemapEntries(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const canonicalUrl = canonicalSitemapUrl(entry.url);
    if (seen.has(canonicalUrl)) return false;
    seen.add(canonicalUrl);
    entry.url = canonicalUrl;
    return true;
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [games, publisherRoutes, lastScrapedAt, psPlusPlans, catalogAvailability] = await Promise.all([
    listSitemapGames(),
    listPublisherRoutes(),
    getLastScrapedAt(),
    getAllPsPlusPlans(),
    listCatalogAvailability(),
  ]);
  const availableGenres = GENRES.filter((genre) => catalogAvailability.some((row) =>
    row.genreLabel?.toLowerCase().includes(genre.genre.toLowerCase())
  ));
  const availablePurchaseTypes = PURCHASE_TYPE_PAGES.filter((page) => catalogAvailability.some((row) =>
    row.productType === page.productType && row.tier === (page.tier ?? null)
  ));
  const activePsPlusTiers = new Set(
    psPlusPlans.filter((plan) => plan.isActive).map((plan) => TIER_SLUG[plan.tier])
  );

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, ...lastModifiedField(lastScrapedAt), changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/upcoming`, ...lastModifiedField(lastScrapedAt), changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/ps-plus`, ...lastModifiedField(lastScrapedAt), changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/guide`, ...lastModifiedField(lastScrapedAt), changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/guide/ps5-capacity-accounts`, ...lastModifiedField(lastScrapedAt), changeFrequency: "monthly", priority: 0.75 },
  ];

  const genreRoutes: MetadataRoute.Sitemap = availableGenres.map((g) => ({
    url: `${SITE_URL}/genres/${g.slug}`,
    ...lastModifiedField(lastScrapedAt),
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const psPlusRoutes: MetadataRoute.Sitemap = Object.values(TIER_SLUG)
    .filter((slug) => activePsPlusTiers.has(slug))
    .map((slug) => ({
    url: `${SITE_URL}/ps-plus/${slug}`,
    ...lastModifiedField(lastScrapedAt),
    changeFrequency: "daily",
    priority: 0.7,
    }));

  const publisherSitemapRoutes: MetadataRoute.Sitemap = publisherRoutes.map((publisher) => ({
    url: `${SITE_URL}/publishers/${publisher.slug}`,
    ...lastModifiedField(lastScrapedAt),
    changeFrequency: "daily",
    priority: 0.65,
  }));

  const purchaseTypeRoutes: MetadataRoute.Sitemap = availablePurchaseTypes.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    ...lastModifiedField(lastScrapedAt),
    changeFrequency: "daily",
    priority: 0.75,
  }));

  const trustRoutes: MetadataRoute.Sitemap = TRUST_PAGES.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    ...lastModifiedField(lastScrapedAt),
    changeFrequency: "monthly",
    priority: 0.4,
  }));

  const gameRoutes: MetadataRoute.Sitemap = games.map((game) => ({
    url: `${SITE_URL}/games/${game.slug}`,
    ...lastModifiedField(game.lastSeenAt ? new Date(game.lastSeenAt) : lastScrapedAt),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return deduplicateSitemapEntries([
    ...staticRoutes,
    ...genreRoutes,
    ...psPlusRoutes,
    ...publisherSitemapRoutes,
    ...purchaseTypeRoutes,
    ...trustRoutes,
    ...gameRoutes,
  ]);
}
