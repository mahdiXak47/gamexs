import { query } from "./db";
import { coverUrl as localCoverUrl } from "./covers";
import { emptyPurchaseOptions, findOption } from "./purchase-options";
import type { AccessTier, Game, GameSummary, ProductType } from "./types";

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
    coverInitial: deriveInitial(row.title),
    coverUrl: row.cover_url ?? localCoverUrl(row.title),
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
