import { cache } from "react";
import { query } from "./db";
import { s3CoverUrl, s3ScreenshotUrl, normalizeS3Url } from "./covers";
import { getGameDetails } from "./game-details";
import { emptyPurchaseOptions, findOption, purchasePathLabel } from "./purchase-options";
import type { AccessTier, Game, GameSummary, ProductType, SortOption, UpcomingGame } from "./types";

// Resolve cover URL — S3 only, normalized to HTTPS.
// 1. DB stores an S3 URL (gs3.gamexs.ir) → use directly (https-normalized).
// 2. Anything else (IGDB CDN, seller CDN, old /api/ path, null) → construct
//    the S3 URL from the slug. Returns null if not yet uploaded to S3.
function toCoverUrl(dbUrl: string | null, slug: string): string | null {
  if (dbUrl?.includes("gs3.gamexs.ir")) return normalizeS3Url(dbUrl);
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

interface GameSummaryRow {
  slug: string;
  title: string;
  genre_label: string | null;
  publisher: string | null;
  cover_url: string | null;
  lowest_price: string | null;
  lowest_product_type: ProductType | null;
  lowest_tier: AccessTier | null;
  store_count: string;
  purchase_type_count: string;
  created_at: Date;
}

function rowToGameSummary(row: GameSummaryRow): GameSummary {
  return {
    slug: row.slug,
    title: row.title,
    genreLabel: row.genre_label,
    publisher: row.publisher,
    coverInitial: deriveInitial(row.title),
    coverUrl: toCoverUrl(row.cover_url, row.slug),
    lowestPriceToman: row.lowest_price === null ? null : Number(row.lowest_price),
    lowestPriceLabel: row.lowest_product_type
      ? purchasePathLabel(row.lowest_product_type, row.lowest_tier)
      : null,
    storeCount: Number(row.store_count),
    purchaseTypeCount: Number(row.purchase_type_count),
    createdAt: row.created_at.getTime(),
  };
}

function slugLookupCandidates(slug: string): string[] {
  const decoded = (() => {
    try {
      return decodeURIComponent(slug);
    } catch {
      return slug;
    }
  })();
  const normalized = Array.from(new Set([
    slug,
    decoded,
    slug.normalize("NFC"),
    decoded.normalize("NFC"),
    slug.normalize("NFD"),
    decoded.normalize("NFD"),
  ]));

  return Array.from(new Set(normalized.flatMap((candidate) => [
    candidate,
    candidate.replace(/-/g, "_"),
    candidate.replace(/_/g, "-"),
  ])));
}

// Words that mark a title as "an edition of" some base game rather than a
// distinct title — mirrors scraper/gamexs_scraper/enrich_metadata.py's
// _EDITION_RE keyword list. Used to detect other purchasable editions of the
// same game (e.g. "Battlefield 6" / "Battlefield 6 Phantom Edition") for the
// game detail page's "versions" row. IGDB inconsistently assigns editions
// either the same igdb_id (Resident Evil 4 Remake's 4 editions) or a
// completely different one (Battlefield 6 vs. Phantom Edition; Death
// Stranding vs. Director's Cut — confirmed against the live DB), so igdb_id
// alone isn't reliable — this title heuristic is the primary signal.
// Deliberately excludes "remake"/"remastered" (unlike enrich_metadata.py's
// list this is derived from) — a remake is a different product from the
// original (different dev team, content, often price), not a cosmetic SKU
// variant. Confirmed against real data: stripping "remake" here would wrongly
// group "Resident Evil 4 Remake" editions with the unrelated 2005 original's
// "Resident Evil 4"/"Resident Evil 4 Gold Edition" rows.
const _EDITION_WORDS = new Set([
  "edition", "standard", "deluxe", "gold", "platinum", "ultimate", "complete",
  "goty", "premium", "digital", "bundle", "definitive",
  "legendary", "collectors", "directors", "enhanced", "anniversary", "launch",
  "cut", "ps4", "ps5",
]);

function _normalizeEditionWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[.,]+$/, "")
    .replace(/'s$/, "s");
}

// Strips a trailing edition qualifier so "Battlefield 6 Phantom Edition" and
// "Cyberpunk 2077 Ultimate Edition" reduce to their base title ("Battlefield
// 6", "Cyberpunk 2077") for same-game comparison. Pops recognized keyword
// words off the end one at a time; if exactly one word was popped and it was
// bare "edition"/"cut", pops one more (the thematic qualifier immediately
// before it, e.g. "Phantom", "Director's"). Never returns an empty string.
function stripEditionSuffix(title: string): string {
  const words = title.trim().split(/\s+/);
  if (words.length <= 1) return title;

  let end = words.length;
  let poppedCount = 0;
  while (end > 1 && _EDITION_WORDS.has(_normalizeEditionWord(words[end - 1]))) {
    end--;
    poppedCount++;
  }
  if (poppedCount === 1) {
    const sole = _normalizeEditionWord(words[end]);
    if ((sole === "edition" || sole === "cut") && end > 1) end--;
  }

  const result = words.slice(0, end).join(" ").trim();
  return result.length > 0 ? result : title;
}

export async function listGames(): Promise<GameSummary[]> {
  const { rows } = await query<GameSummaryRow>(`
    ${LATEST_PRICE_CTE}
    SELECT
      g.slug,
      g.title,
      g.genre_label,
      g.publisher,
      g.cover_url,
      g.created_at,
      MIN(latest.price_toman) FILTER (WHERE latest.in_stock AND latest.price_toman > 0) AS lowest_price,
      (ARRAY_AGG(l.product_type ORDER BY latest.price_toman) FILTER (WHERE latest.in_stock AND latest.price_toman > 0))[1] AS lowest_product_type,
      (ARRAY_AGG(l.tier ORDER BY latest.price_toman) FILTER (WHERE latest.in_stock AND latest.price_toman > 0))[1] AS lowest_tier,
      COUNT(DISTINCT l.seller_id) AS store_count,
      COUNT(DISTINCT (l.product_type, l.tier)) AS purchase_type_count
    FROM ps5_games g
    JOIN listings l ON l.game_id = g.id AND l.is_active
    JOIN latest ON latest.listing_id = l.id
    WHERE g.platform_id = (SELECT id FROM platforms WHERE slug = 'ps5')
    GROUP BY g.id
    ORDER BY g.title
  `);

  return rows.map(rowToGameSummary);
}

const SORT_CLAUSE: Record<SortOption, string> = {
  popular: "store_count DESC, title ASC",
  newest: "created_at DESC",
  price_asc: "lowest_price ASC NULLS LAST",
  price_desc: "lowest_price DESC NULLS LAST",
  alpha_asc: "title ASC",
  alpha_desc: "title DESC",
};

export interface ListGamesOptions {
  genre?: string;
  query?: string;
  publishers?: string[];
  productType?: ProductType;
  tier?: AccessTier;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
  // Homepage only shows games with at least one active listing (matches the
  // previous INNER JOIN behavior); genre/search pages show every match
  // regardless of listing count (previous LEFT JOIN behavior). Preserved as
  // a flag rather than unified, to avoid changing either page's visible results.
  onlyWithListings?: boolean;
}

export interface PagedGames {
  games: GameSummary[];
  total: number;
}

// Single paginated/filtered/sorted query backing the homepage, genre pages,
// and search — replaces three separate "fetch every matching row, filter/sort/
// paginate in the browser" functions. That older approach sent all ~2,000
// PS5 games to the client on every homepage load (an ~850KB payload and a
// slow query), regardless of the 20 actually shown per page.
export async function listGamesPage(options: ListGamesOptions = {}): Promise<PagedGames> {
  const {
    genre = null,
    query: search = null,
    publishers = null,
    productType = null,
    tier = null,
    sort = "popular",
    page = 1,
    pageSize = 20,
  } = options;

  const { rows } = await query<GameSummaryRow & { total_count: string }>(
    `
    ${LATEST_PRICE_CTE}
    , filtered AS (
      SELECT
        g.slug,
        g.title,
        g.genre_label,
        g.publisher,
        g.cover_url,
        g.created_at,
        MIN(latest.price_toman) FILTER (WHERE latest.in_stock AND latest.price_toman > 0) AS lowest_price,
        (ARRAY_AGG(l.product_type ORDER BY latest.price_toman) FILTER (WHERE latest.in_stock AND latest.price_toman > 0))[1] AS lowest_product_type,
        (ARRAY_AGG(l.tier ORDER BY latest.price_toman) FILTER (WHERE latest.in_stock AND latest.price_toman > 0))[1] AS lowest_tier,
        COUNT(DISTINCT l.seller_id) AS store_count,
        COUNT(DISTINCT (l.product_type, l.tier)) AS purchase_type_count
      FROM ps5_games g
      LEFT JOIN listings l ON l.game_id = g.id AND l.is_active
      LEFT JOIN latest ON latest.listing_id = l.id
      WHERE g.platform_id = (SELECT id FROM platforms WHERE slug = 'ps5')
        AND ($1::text IS NULL OR g.genre_label ILIKE $1)
        AND ($2::text IS NULL OR g.title ILIKE $2 OR g.genre_label ILIKE $2)
        AND ($3::text[] IS NULL OR g.publisher = ANY($3))
        AND ($7::product_type IS NULL OR l.product_type = $7::product_type)
        AND ($8::access_tier IS NULL OR l.tier = $8::access_tier)
      GROUP BY g.id
      HAVING NOT $6 OR COUNT(DISTINCT l.id) > 0
    )
    SELECT *, COUNT(*) OVER() AS total_count
    FROM filtered
    ORDER BY ${SORT_CLAUSE[sort]}
    LIMIT $4 OFFSET $5
    `,
    [
      genre ? `%${genre}%` : null,
      search ? `%${search}%` : null,
      publishers && publishers.length > 0 ? publishers : null,
      pageSize,
      (page - 1) * pageSize,
      options.onlyWithListings ?? false,
      productType,
      tier,
    ]
  );

  const games = rows.map(rowToGameSummary);

  return { games, total: rows.length > 0 ? Number(rows[0].total_count) : 0 };
}

// Publishers with ≥ 2 games, sorted alphabetically — single-game publishers
// are excluded as they add noise without useful filtering value. Optionally
// scoped to a genre so the genre pages' filter only lists relevant publishers.
export async function listPublishers(genre?: string): Promise<string[]> {
  const { rows } = await query<{ publisher: string }>(
    `
    SELECT publisher
    FROM ps5_games
    WHERE platform_id = (SELECT id FROM platforms WHERE slug = 'ps5')
      AND publisher IS NOT NULL
      AND ($1::text IS NULL OR genre_label ILIKE $1)
    GROUP BY publisher
    HAVING count(*) >= 2
    ORDER BY publisher
    `,
    [genre ? `%${genre}%` : null]
  );
  return rows.map((r) => r.publisher);
}

export function publisherToSlug(publisher: string): string {
  return publisher
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function listPublisherRoutes(): Promise<{ slug: string; name: string }[]> {
  const publishers = await listPublishers();
  return publishers
    .map((name) => ({ name, slug: publisherToSlug(name) }))
    .filter((publisher) => publisher.slug.length > 0);
}

export async function getPublisherBySlug(slug: string): Promise<string | null> {
  const publishers = await listPublisherRoutes();
  return publishers.find((publisher) => publisher.slug === slug)?.name ?? null;
}

// Other PS5 games sharing at least one genre — powers the "similar games" row
// on the game detail page. Matches against the full IGDB genres array (e.g.
// {Shooter, Adventure}), not just genre_label, which only stores one primary
// genre and can make a genuinely multi-genre game (e.g. Death Stranding 2 —
// Shooter *and* Adventure) look narrower than it is. Ranked by how many
// genres overlap first, so a game sharing 2 of 2 genres beats one sharing 1.
// Returns [] when the game has no genres at all rather than falling back to
// some other signal, since an unrelated game list would be worse than none.
export async function getSimilarGames(
  gameId: number,
  genres: string[],
  limit = 16
): Promise<GameSummary[]> {
  if (genres.length === 0) return [];

  const { rows } = await query<GameSummaryRow & { overlap: number }>(
    `
    ${LATEST_PRICE_CTE}
    SELECT
      g.slug,
      g.title,
      g.genre_label,
      g.publisher,
      g.cover_url,
      g.created_at,
      MIN(latest.price_toman) FILTER (WHERE latest.in_stock AND latest.price_toman > 0) AS lowest_price,
      (ARRAY_AGG(l.product_type ORDER BY latest.price_toman) FILTER (WHERE latest.in_stock AND latest.price_toman > 0))[1] AS lowest_product_type,
      (ARRAY_AGG(l.tier ORDER BY latest.price_toman) FILTER (WHERE latest.in_stock AND latest.price_toman > 0))[1] AS lowest_tier,
      COUNT(DISTINCT l.seller_id) AS store_count,
      COUNT(DISTINCT (l.product_type, l.tier)) AS purchase_type_count,
      cardinality(ARRAY(SELECT unnest(g.genres) INTERSECT SELECT unnest($1::text[]))) AS overlap
    FROM ps5_games g
    JOIN listings l ON l.game_id = g.id AND l.is_active
    JOIN latest ON latest.listing_id = l.id
    WHERE g.platform_id = (SELECT id FROM platforms WHERE slug = 'ps5')
      AND g.genres && $1::text[]
      AND g.id != $2
    GROUP BY g.id
    ORDER BY overlap DESC, store_count DESC, g.title
    LIMIT $3
    `,
    [genres, gameId, limit]
  );

  return rows.map(rowToGameSummary);
}

// Other PS5 games sharing at least one developer studio — powers the "same
// developer" row on the game detail page (e.g. Kojima Productions games for
// Death Stranding 2). Same array-overlap + overlap-count ranking as
// getSimilarGames, just matched against ps5_games.developers instead of
// genres. Returns [] when the game has no developer data.
export async function getSimilarGamesByDeveloper(
  gameId: number,
  developers: string[],
  limit = 16
): Promise<GameSummary[]> {
  if (developers.length === 0) return [];

  const { rows } = await query<GameSummaryRow & { overlap: number }>(
    `
    ${LATEST_PRICE_CTE}
    SELECT
      g.slug,
      g.title,
      g.genre_label,
      g.publisher,
      g.cover_url,
      g.created_at,
      MIN(latest.price_toman) FILTER (WHERE latest.in_stock AND latest.price_toman > 0) AS lowest_price,
      (ARRAY_AGG(l.product_type ORDER BY latest.price_toman) FILTER (WHERE latest.in_stock AND latest.price_toman > 0))[1] AS lowest_product_type,
      (ARRAY_AGG(l.tier ORDER BY latest.price_toman) FILTER (WHERE latest.in_stock AND latest.price_toman > 0))[1] AS lowest_tier,
      COUNT(DISTINCT l.seller_id) AS store_count,
      COUNT(DISTINCT (l.product_type, l.tier)) AS purchase_type_count,
      cardinality(ARRAY(SELECT unnest(g.developers) INTERSECT SELECT unnest($1::text[]))) AS overlap
    FROM ps5_games g
    JOIN listings l ON l.game_id = g.id AND l.is_active
    JOIN latest ON latest.listing_id = l.id
    WHERE g.platform_id = (SELECT id FROM platforms WHERE slug = 'ps5')
      AND g.developers && $1::text[]
      AND g.id != $2
    GROUP BY g.id
    ORDER BY overlap DESC, store_count DESC, g.title
    LIMIT $3
    `,
    [developers, gameId, limit]
  );

  return rows.map(rowToGameSummary);
}

// Other purchasable editions of the SAME game (e.g. "Battlefield 6 Phantom
// Edition" for "Battlefield 6") — powers the "versions" row on the game
// detail page, above the genre/developer similar-games rows. Broad ILIKE
// prefetch on the base title's first two words (cheap, cast a wide net),
// then precise filtering in JS via stripEditionSuffix() equality.
//
// Deliberately does NOT also match on igdb_id equality — verified against
// real data that our own IGDB enrichment sometimes merges a remake and its
// unrelated original under one igdb_id (confirmed: "Resident Evil 4" (2005)
// and "Resident Evil 4 Remake" share an igdb_id in this DB), which would
// wrongly surface the original as a "version" of the remake. Title matching
// alone already correctly finds every real edition group tested.
export async function getGameVersions(
  gameId: number,
  title: string,
  limit = 10
): Promise<GameSummary[]> {
  const baseTitle = stripEditionSuffix(title).toLowerCase();
  const prefix = baseTitle.split(/\s+/).slice(0, 2).join(" ");

  const { rows } = await query<GameSummaryRow>(
    `
    ${LATEST_PRICE_CTE}
    SELECT
      g.slug,
      g.title,
      g.genre_label,
      g.publisher,
      g.cover_url,
      g.created_at,
      MIN(latest.price_toman) FILTER (WHERE latest.in_stock AND latest.price_toman > 0) AS lowest_price,
      (ARRAY_AGG(l.product_type ORDER BY latest.price_toman) FILTER (WHERE latest.in_stock AND latest.price_toman > 0))[1] AS lowest_product_type,
      (ARRAY_AGG(l.tier ORDER BY latest.price_toman) FILTER (WHERE latest.in_stock AND latest.price_toman > 0))[1] AS lowest_tier,
      COUNT(DISTINCT l.seller_id) AS store_count,
      COUNT(DISTINCT (l.product_type, l.tier)) AS purchase_type_count
    FROM ps5_games g
    JOIN listings l ON l.game_id = g.id AND l.is_active
    JOIN latest ON latest.listing_id = l.id
    WHERE g.platform_id = (SELECT id FROM platforms WHERE slug = 'ps5')
      AND g.id != $1
      AND g.title ILIKE $2
    GROUP BY g.id
    ORDER BY store_count DESC, g.title
    `,
    [gameId, `${prefix}%`]
  );

  const matched = rows.filter((row) => stripEditionSuffix(row.title).toLowerCase() === baseTitle);

  return matched.slice(0, limit).map(rowToGameSummary);
}

// Wrapped in React's per-request cache so generateMetadata and the page
// component (both calling this for the same slug) share one DB round-trip.
export const getGameBySlug = cache(async function getGameBySlug(slug: string): Promise<Game | null> {
  const slugCandidates = slugLookupCandidates(slug);
  const { rows: gameRows } = await query<{
    id: number;
    slug: string;
    title: string;
    genre_label: string | null;
    genres: string[] | null;
    developers: string[] | null;
    publisher: string | null;
    release_year: number | null;
    release_date: Date | null;
    cover_url: string | null;
    key_art_url: string | null;
    screenshot_ids: string[] | null;
  }>(
    `
    SELECT id, slug, title, genre_label, genres, developers, publisher, release_year, release_date, cover_url, key_art_url, screenshot_ids
    FROM ps5_games
    WHERE slug = ANY($1::text[])
    ORDER BY array_position($1::text[], slug)
    LIMIT 1
    `,
    [slugCandidates]
  );

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
      if (id.startsWith("http")) return [normalizeS3Url(id)];
      if (id.includes(".")) return [s3ScreenshotUrl(id)];
      return []; // IGDB-only ID — no S3 copy, omit
    });

  return {
    dbId: game.id,
    slug: game.slug,
    title: game.title,
    genreLabel: game.genre_label,
    // Fall back to [genre_label] for the ~3% of games with a primary genre
    // but no full genres array yet, so they still get a similar-games list.
    genres: game.genres?.length ? game.genres : game.genre_label ? [game.genre_label] : [],
    developers: game.developers ?? [],
    publisher: game.publisher,
    releaseYear: game.release_year,
    coverInitial: deriveInitial(game.title),
    coverUrl: toCoverUrl(game.cover_url, game.slug),
    keyArtUrl: game.key_art_url ? normalizeS3Url(game.key_art_url) : null,
    releaseDate: game.release_date ? game.release_date.toISOString().slice(0, 10) : null,
    screenshots,
    purchaseOptions,
    details: getGameDetails(game.slug),
  };
});

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
    MIN(latest.price_toman) FILTER (WHERE latest.in_stock AND latest.price_toman > 0) AS lowest_price,
    COUNT(DISTINCT l.seller_id) AS seller_count
  FROM ps5_games g
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
    keyArtUrl: row.key_art_url ? normalizeS3Url(row.key_art_url) : null,
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
      MIN(latest.price_toman) FILTER (WHERE latest.in_stock AND latest.price_toman > 0) AS lowest_price,
      COUNT(DISTINCT l.seller_id) AS seller_count,
      w.ord AS slug_order
    FROM ps5_games g
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

export interface PsStoreInfo {
  hasData: boolean;
  conceptId: string | null;
  usCurrent: string | null;
  usOriginal: string | null;
  usDiscount: string | null;
  trCurrent: string | null;
  trOriginal: string | null;
  trDiscount: string | null;
  essentialPlus: boolean;
  extraPlus: boolean;
  deluxePlus: boolean;
}

export async function getGameStoreInfo(gameId: number): Promise<PsStoreInfo | null> {
  const { rows } = await query<{
    concept_id: string;
    us_price: string | null;
    us_original_price: string | null;
    us_discount_pct: string | null;
    tr_price: string | null;
    tr_original_price: string | null;
    tr_discount_pct: string | null;
    essential_plus_included: boolean;
    extra_plus_included: boolean;
    deluxe_plus_included: boolean;
  }>(
    `SELECT concept_id, us_price, us_original_price, us_discount_pct,
            tr_price, tr_original_price, tr_discount_pct,
            essential_plus_included, extra_plus_included, deluxe_plus_included
     FROM ps5_store_info WHERE game_id = $1`,
    [gameId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    hasData:    true,
    conceptId:  row.concept_id,
    usCurrent:  row.us_price,
    usOriginal: row.us_original_price,
    usDiscount: row.us_discount_pct,
    trCurrent:  row.tr_price,
    trOriginal: row.tr_original_price,
    trDiscount: row.tr_discount_pct,
    essentialPlus: row.essential_plus_included,
    extraPlus:     row.extra_plus_included,
    deluxePlus:    row.deluxe_plus_included,
  };
}

export async function getLastScrapedAt(): Promise<Date | null> {
  const { rows } = await query<{ last_scraped_at: Date | null }>(
    `SELECT MAX(scraped_at) AS last_scraped_at FROM price_history`
  );
  return rows[0]?.last_scraped_at ?? null;
}
