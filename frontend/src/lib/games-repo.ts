import { query } from "./db";
import { coverUrl as localCoverUrl } from "./covers";
import { emptyPurchaseOptions, findOption } from "./purchase-options";
import type { AccessTier, Game, GameSummary, ProductType } from "./types";

// Resolve cover URL with two-tier fallback:
// 1. Local pspro image (scraped file on disk) — present in local dev, absent in production.
// 2. IGDB URL via server-side proxy — images.igdb.com is blocked in Iran for browsers,
//    but the k8s server can reach it, so the proxy bridges the gap in production.
//    In dev the Next.js server also runs locally (in Iran) and can't reach IGDB,
//    so we skip the proxy and let the initial-letter fallback show instead.
function toCoverUrl(dbUrl: string | null, title: string): string | null {
  const local = localCoverUrl(title);
  if (local) return local;
  if (!dbUrl) return null;
  if (dbUrl.includes("images.igdb.com")) {
    if (process.env.NODE_ENV !== "production") return null;
    return `/api/cover-proxy?url=${encodeURIComponent(dbUrl)}`;
  }
  return dbUrl;
}

// "Current" price/stock per listing is the most recent price_history row —
// never an all-time min/max, since price_history accumulates one row per
// scrape and older rows shouldn't outrank a fresher one.
const LATEST_PRICE_CTE = `
  WITH latest AS (
    SELECT DISTINCT ON (listing_id) listing_id, price_toman, in_stock
    FROM price_history
    ORDER BY listing_id, scraped_at DESC
  )
`;

function deriveInitial(title: string): string {
  const letters = title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

export async function listGames(): Promise<GameSummary[]> {
  const { rows } = await query<{
    slug: string;
    title: string;
    genre_label: string | null;
    publisher: string | null;
    cover_url: string | null;
    lowest_price: string | null;
    store_count: string;
    purchase_type_count: string;
    created_at: Date;
  }>(`
    ${LATEST_PRICE_CTE}
    SELECT
      g.slug,
      g.title,
      g.genre_label,
      g.publisher,
      g.cover_url,
      g.created_at,
      MIN(latest.price_toman) AS lowest_price,
      COUNT(DISTINCT l.seller_id) AS store_count,
      COUNT(DISTINCT (l.product_type, l.tier)) AS purchase_type_count
    FROM games g
    JOIN listings l ON l.game_id = g.id AND l.is_active
    JOIN latest ON latest.listing_id = l.id
    WHERE g.platform_id = (SELECT id FROM platforms WHERE slug = 'ps5')
    GROUP BY g.id
    ORDER BY g.title
  `);

  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    genreLabel: row.genre_label,
    publisher: row.publisher,
    coverInitial: deriveInitial(row.title),
    coverUrl: toCoverUrl(row.cover_url, row.title),
    lowestPriceToman: row.lowest_price === null ? null : Number(row.lowest_price),
    storeCount: Number(row.store_count),
    purchaseTypeCount: Number(row.purchase_type_count),
    createdAt: row.created_at.getTime(),
  }));
}

export async function getGameBySlug(slug: string): Promise<Game | null> {
  const { rows: gameRows } = await query<{
    id: number;
    slug: string;
    title: string;
    genre_label: string | null;
    publisher: string | null;
    release_year: number | null;
    cover_url: string | null;
  }>(`SELECT id, slug, title, genre_label, publisher, release_year, cover_url FROM games WHERE slug = $1`, [slug]);

  const game = gameRows[0];
  if (!game) return null;

  const { rows: offerRows } = await query<{
    product_type: ProductType;
    tier: AccessTier | null;
    seller_slug: string;
    seller_name: string;
    seller_domain: string;
    price_toman: number;
    in_stock: boolean;
    source_url: string;
  }>(
    `
    ${LATEST_PRICE_CTE}
    SELECT l.product_type, l.tier, s.slug AS seller_slug, s.name AS seller_name, s.domain AS seller_domain,
           latest.price_toman, latest.in_stock, l.source_url
    FROM listings l
    JOIN sellers s ON s.id = l.seller_id
    JOIN latest ON latest.listing_id = l.id
    WHERE l.game_id = $1 AND l.is_active
    `,
    [game.id]
  );

  const purchaseOptions = emptyPurchaseOptions();
  for (const row of offerRows) {
    findOption(purchaseOptions, row.product_type, row.tier)?.offers.push({
      sellerId: row.seller_slug,
      sellerName: row.seller_name,
      sellerDomain: row.seller_domain,
      priceToman: Number(row.price_toman),
      inStock: row.in_stock,
      listingUrl: row.source_url,
    });
  }

  return {
    slug: game.slug,
    title: game.title,
    genreLabel: game.genre_label,
    publisher: game.publisher,
    releaseYear: game.release_year,
    coverInitial: deriveInitial(game.title),
    coverUrl: game.cover_url ?? localCoverUrl(game.title),
    purchaseOptions,
  };
}

export async function getLastScrapedAt(): Promise<Date | null> {
  const { rows } = await query<{ last_scraped_at: Date | null }>(
    `SELECT MAX(scraped_at) AS last_scraped_at FROM price_history`
  );
  return rows[0]?.last_scraped_at ?? null;
}
