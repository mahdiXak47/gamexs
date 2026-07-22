import { query } from "./db";
import { s3CoverUrl, s3ScreenshotUrl } from "./covers";
import { getGameDetails } from "./game-details";
import { emptyPurchaseOptions, findOption } from "./purchase-options";
import type { AccessTier, Game, GameSummary, ProductType, UpcomingGame } from "./types";

// Resolve cover URL — S3 only.
// 1. DB stores an S3 URL (gs3.gamexs.ir) → use directly.
// 2. Anything else (IGDB CDN, seller CDN, old /api/ path, null) → construct
//    the S3 URL from the slug. Returns null if not yet uploaded to S3.
function toCoverUrl(dbUrl: string | null, slug: string): string | null {
  if (dbUrl?.includes("gs3.gamexs.ir")) return dbUrl;
  return s3CoverUrl(slug);
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
    coverUrl: toCoverUrl(row.cover_url, row.slug),
    lowestPriceToman: row.lowest_price === null ? null : Number(row.lowest_price),
    storeCount: Number(row.store_count),
    purchaseTypeCount: Number(row.purchase_type_count),
    createdAt: row.created_at.getTime(),
  }));
}

export async function getGamesByGenre(genre: string): Promise<GameSummary[]> {
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
    LEFT JOIN listings l ON l.game_id = g.id AND l.is_active
    LEFT JOIN latest ON latest.listing_id = l.id
    WHERE g.genre_label ILIKE $1
      AND g.platform_id = (SELECT id FROM platforms WHERE slug = 'ps5')
    GROUP BY g.id
    ORDER BY store_count DESC, g.title
  `, [`%${genre}%`]);

  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    genreLabel: row.genre_label,
    publisher: row.publisher,
    coverInitial: deriveInitial(row.title),
    coverUrl: toCoverUrl(row.cover_url, row.slug),
    lowestPriceToman: row.lowest_price === null ? null : Number(row.lowest_price),
    storeCount: Number(row.store_count),
    purchaseTypeCount: Number(row.purchase_type_count),
    createdAt: row.created_at.getTime(),
  }));
}

export async function searchGames(q: string): Promise<GameSummary[]> {
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
    LEFT JOIN listings l ON l.game_id = g.id AND l.is_active
    LEFT JOIN latest ON latest.listing_id = l.id
    WHERE g.title ILIKE $1
      AND g.platform_id = (SELECT id FROM platforms WHERE slug = 'ps5')
    GROUP BY g.id
    ORDER BY g.title
    LIMIT 200
  `, [`%${q}%`]);

  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    genreLabel: row.genre_label,
    publisher: row.publisher,
    coverInitial: deriveInitial(row.title),
    coverUrl: toCoverUrl(row.cover_url, row.slug),
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
    release_date: Date | null;
    cover_url: string | null;
    key_art_url: string | null;
    screenshot_ids: string[] | null;
  }>(`SELECT id, slug, title, genre_label, publisher, release_year, release_date, cover_url, key_art_url, screenshot_ids FROM games WHERE slug = $1`, [slug]);

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

  // screenshot_ids has three shapes:
  // - Full URL (starts with 'http') → S3 or external CDN, use as-is
  // Screenshots — S3 only. Three shapes in the DB:
  // - Full S3 URL (starts with "http") → use directly.
  // - Bare filename with extension     → construct S3 URL.
  // - IGDB image_id (no extension)     → skip; not on S3 yet.
  const screenshots = (game.screenshot_ids ?? [])
    .flatMap((id) => {
      if (id.startsWith("http")) return [id];
      if (id.includes(".")) return [s3ScreenshotUrl(id)];
      return []; // IGDB-only ID — no S3 copy, omit
    });

  return {
    slug: game.slug,
    title: game.title,
    genreLabel: game.genre_label,
    publisher: game.publisher,
    releaseYear: game.release_year,
    coverInitial: deriveInitial(game.title),
    coverUrl: toCoverUrl(game.cover_url, game.slug),
    keyArtUrl: game.key_art_url ?? null,
    releaseDate: game.release_date ? game.release_date.toISOString().slice(0, 10) : null,
    screenshots,
    purchaseOptions,
    details: getGameDetails(game.slug),
  };
}

const UPCOMING_QUERY = `
  WITH latest AS (
    SELECT DISTINCT ON (listing_id) listing_id, price_toman, in_stock
    FROM price_history
    ORDER BY listing_id, scraped_at DESC
  )
  SELECT
    g.slug,
    g.title,
    g.cover_url,
    g.key_art_url,
    g.release_date,
    MIN(latest.price_toman) AS lowest_price,
    COUNT(DISTINCT l.seller_id) AS seller_count
  FROM games g
  JOIN listings l ON l.game_id = g.id AND l.is_active
  JOIN latest ON latest.listing_id = l.id
  WHERE g.release_date > CURRENT_DATE
    AND g.platform_id = (SELECT id FROM platforms WHERE slug = 'ps5')
  GROUP BY g.id
  ORDER BY g.release_date ASC
`;

function rowToUpcoming(row: { slug: string; title: string; cover_url: string | null; key_art_url: string | null; release_date: Date; lowest_price: string | null; seller_count: string }): UpcomingGame {
  return {
    slug: row.slug,
    title: row.title,
    coverUrl: toCoverUrl(row.cover_url, row.slug),
    keyArtUrl: row.key_art_url ?? null,
    releaseDate: row.release_date.toISOString().slice(0, 10),
    lowestPriceToman: row.lowest_price === null ? null : Number(row.lowest_price),
    sellerCount: Number(row.seller_count),
  };
}

export async function listUpcomingGames(limit = 8): Promise<UpcomingGame[]> {
  const { rows } = await query<Parameters<typeof rowToUpcoming>[0]>(
    UPCOMING_QUERY + `LIMIT $1`,
    [limit]
  );
  return rows.map(rowToUpcoming);
}

export async function listAllUpcomingGames(): Promise<UpcomingGame[]> {
  const { rows } = await query<Parameters<typeof rowToUpcoming>[0]>(UPCOMING_QUERY);
  return rows.map(rowToUpcoming);
}

export async function getFeaturedUpcomingGames(slugs: string[]): Promise<UpcomingGame[]> {
  if (!slugs.length) return [];
  const { rows } = await query<Parameters<typeof rowToUpcoming>[0] & { slug_order: number }>(
    `
    WITH latest AS (
      SELECT DISTINCT ON (listing_id) listing_id, price_toman, in_stock
      FROM price_history ORDER BY listing_id, scraped_at DESC
    ),
    wanted AS (
      SELECT unnest($1::text[]) AS slug, generate_subscripts($1::text[], 1) AS ord
    )
    SELECT
      g.slug, g.title, g.cover_url, g.key_art_url, g.release_date,
      MIN(latest.price_toman) AS lowest_price,
      COUNT(DISTINCT l.seller_id) AS seller_count,
      w.ord AS slug_order
    FROM games g
    JOIN wanted w ON w.slug = g.slug
    LEFT JOIN listings l ON l.game_id = g.id AND l.is_active
    LEFT JOIN latest ON latest.listing_id = l.id
    WHERE g.release_date IS NOT NULL
    GROUP BY g.id, w.ord
    ORDER BY w.ord
    `,
    [slugs]
  );
  return rows.map(rowToUpcoming);
}

export async function getLastScrapedAt(): Promise<Date | null> {
  const { rows } = await query<{ last_scraped_at: Date | null }>(
    `SELECT MAX(scraped_at) AS last_scraped_at FROM price_history`
  );
  return rows[0]?.last_scraped_at ?? null;
}
