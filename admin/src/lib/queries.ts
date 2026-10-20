import { query } from "./db";

// Read-only views over the scraper's bookkeeping tables:
//   pipeline_runs / pipeline_steps   — live progress of each scrape_all.sh cycle (migration 033)
//   scrape_runs / scrape_run_attempts — per-seller outcome history (migration 032)

export type StepStatus = "queued" | "running" | "succeeded" | "failed" | "skipped" | "abandoned";
export type RunStatus = "running" | "succeeded" | "failed" | "abandoned";

export type PipelineRun = {
  id: string;
  status: RunStatus;
  summary: string | null;
  started_at: Date;
  completed_at: Date | null;
  steps_total: number;
  steps_succeeded: number;
  steps_failed: number;
  steps_skipped: number;
};

export type PipelineStep = {
  id: string;
  name: string;
  position: number;
  status: StepStatus;
  progress_done: number | null;
  progress_total: number | null;
  message: string | null;
  log_tail: string | null;
  exit_code: number | null;
  started_at: Date | null;
  heartbeat_at: Date | null;
  completed_at: Date | null;
  /** Median duration (s) of this step's last successful runs — for queued-step ETAs. */
  typical_seconds: number | null;
};

const RUN_COLUMNS = `
  r.id::text, r.status, r.summary, r.started_at, r.completed_at,
  COUNT(s.id)::int AS steps_total,
  COUNT(s.id) FILTER (WHERE s.status = 'succeeded')::int AS steps_succeeded,
  COUNT(s.id) FILTER (WHERE s.status = 'failed')::int AS steps_failed,
  COUNT(s.id) FILTER (WHERE s.status = 'skipped')::int AS steps_skipped`;

export async function latestRun(): Promise<PipelineRun | null> {
  const { rows } = await query<PipelineRun>(`
    SELECT ${RUN_COLUMNS}
    FROM pipeline_runs r LEFT JOIN pipeline_steps s ON s.pipeline_run_id = r.id
    GROUP BY r.id ORDER BY r.started_at DESC LIMIT 1`);
  return rows[0] ?? null;
}

export async function getRun(id: string): Promise<PipelineRun | null> {
  if (!/^\d+$/.test(id)) return null;
  const { rows } = await query<PipelineRun>(
    `SELECT ${RUN_COLUMNS}
     FROM pipeline_runs r LEFT JOIN pipeline_steps s ON s.pipeline_run_id = r.id
     WHERE r.id = $1 GROUP BY r.id`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listRuns(limit = 30): Promise<PipelineRun[]> {
  const { rows } = await query<PipelineRun>(
    `SELECT ${RUN_COLUMNS}
     FROM pipeline_runs r LEFT JOIN pipeline_steps s ON s.pipeline_run_id = r.id
     GROUP BY r.id ORDER BY r.started_at DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function runSteps(runId: string, withLogs = false): Promise<PipelineStep[]> {
  const { rows } = await query<PipelineStep>(
    `
    SELECT s.id::text, s.name, s.position, s.status, s.progress_done, s.progress_total, s.message,
           ${withLogs ? "s.log_tail" : "NULL::text AS log_tail"},
           s.exit_code, s.started_at, s.heartbeat_at, s.completed_at,
           typical.seconds AS typical_seconds
    FROM pipeline_steps s
    LEFT JOIN LATERAL (
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM p.completed_at - p.started_at))::float AS seconds
      FROM (
        SELECT started_at, completed_at FROM pipeline_steps
        WHERE name = s.name AND status = 'succeeded' AND started_at IS NOT NULL
        ORDER BY completed_at DESC LIMIT 5
      ) p
    ) typical ON true
    WHERE s.pipeline_run_id = $1
    ORDER BY s.position`,
    [runId],
  );
  return rows;
}

export type Freshness = {
  last_price_at: Date | null;
  last_psstore_at: Date | null;
  active_listings: number;
  sellers_with_listings: number;
  catalog_games: number;
};

export async function freshness(): Promise<Freshness> {
  const { rows } = await query<Freshness>(`
    SELECT
      (SELECT MAX(scraped_at) FROM price_history) AS last_price_at,
      (SELECT MAX(fetched_at) FROM ps5_game_us_info) AS last_psstore_at,
      (SELECT COUNT(*)::int FROM listings WHERE is_active) AS active_listings,
      (SELECT COUNT(DISTINCT seller_id)::int FROM listings WHERE is_active) AS sellers_with_listings,
      (SELECT COUNT(*)::int FROM ps5_games) AS catalog_games`);
  return rows[0];
}

export type StoreHealth = {
  slug: string;
  name: string;
  domain: string;
  active_listings: number;
  last_status: "running" | "succeeded" | "failed" | null;
  last_started_at: Date | null;
  last_success_at: Date | null;
  last_loaded_listings: number | null;
  last_failure_reason: string | null;
  ok_7d: number;
  failed_7d: number;
  ok_30d: number;
  failed_30d: number;
  typical_seconds: number | null;
};

export async function storeHealth(): Promise<StoreHealth[]> {
  const { rows } = await query<StoreHealth>(`
    SELECT
      se.slug, se.name, se.domain,
      (SELECT COUNT(*)::int FROM listings l WHERE l.seller_id = se.id AND l.is_active) AS active_listings,
      last.status AS last_status, last.started_at AS last_started_at,
      (SELECT MAX(completed_at) FROM scrape_runs WHERE seller_id = se.id AND status = 'succeeded') AS last_success_at,
      (SELECT loaded_listings FROM scrape_runs WHERE seller_id = se.id AND status = 'succeeded'
        ORDER BY completed_at DESC LIMIT 1) AS last_loaded_listings,
      (SELECT failure_reason FROM scrape_runs WHERE seller_id = se.id AND status = 'failed'
        ORDER BY started_at DESC LIMIT 1) AS last_failure_reason,
      COUNT(sr.id) FILTER (WHERE sr.status = 'succeeded' AND sr.started_at > now() - interval '7 days')::int AS ok_7d,
      COUNT(sr.id) FILTER (WHERE sr.status = 'failed' AND sr.started_at > now() - interval '7 days')::int AS failed_7d,
      COUNT(sr.id) FILTER (WHERE sr.status = 'succeeded')::int AS ok_30d,
      COUNT(sr.id) FILTER (WHERE sr.status = 'failed')::int AS failed_30d,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM sr.completed_at - sr.started_at))
        FILTER (WHERE sr.status = 'succeeded')::float AS typical_seconds
    FROM sellers se
    LEFT JOIN scrape_runs sr ON sr.seller_id = se.id AND sr.started_at > now() - interval '30 days'
    LEFT JOIN LATERAL (
      SELECT status, started_at FROM scrape_runs WHERE seller_id = se.id ORDER BY started_at DESC LIMIT 1
    ) last ON true
    WHERE se.is_active
    GROUP BY se.id, last.status, last.started_at
    ORDER BY se.slug`);
  return rows;
}

export type DailyOutcome = { day: string; succeeded: number; failed: number };

/** Per-day seller outcomes plus pipeline task outcomes (IGDB, PS Store, S3, cleanup). */
export async function dailyOutcomes(days = 14): Promise<DailyOutcome[]> {
  const { rows } = await query<DailyOutcome>(
    `
    WITH outcomes AS (
      SELECT started_at, status FROM scrape_runs WHERE status IN ('succeeded', 'failed')
      UNION ALL
      SELECT s.started_at, s.status FROM pipeline_steps s
      WHERE s.status IN ('succeeded', 'failed') AND s.started_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM sellers WHERE slug = s.name)
    )
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
           COUNT(o.*) FILTER (WHERE o.status = 'succeeded')::int AS succeeded,
           COUNT(o.*) FILTER (WHERE o.status = 'failed')::int AS failed
    FROM generate_series(
      (now() AT TIME ZONE 'Asia/Tehran')::date - ($1::int - 1),
      (now() AT TIME ZONE 'Asia/Tehran')::date, interval '1 day') AS d(day)
    LEFT JOIN outcomes o ON (o.started_at AT TIME ZONE 'Asia/Tehran')::date = d.day::date
    GROUP BY d.day ORDER BY d.day`,
    [days],
  );
  return rows;
}

export type Failure = {
  source: string;
  attempt: number | null;
  error: string | null;
  at: Date;
  run_id: string | null;
};

export async function recentFailures(limit = 12): Promise<Failure[]> {
  const { rows } = await query<Failure>(
    `
    (SELECT se.slug AS source, a.attempt_no AS attempt, a.error, COALESCE(a.completed_at, a.started_at) AS at,
            NULL::text AS run_id
     FROM scrape_run_attempts a
     JOIN scrape_runs sr ON sr.id = a.run_id JOIN sellers se ON se.id = sr.seller_id
     WHERE a.status IN ('failed', 'suspicious'))
    UNION ALL
    (SELECT s.name, NULL, COALESCE(s.message, 'exit code ' || s.exit_code), s.completed_at, s.pipeline_run_id::text
     FROM pipeline_steps s
     WHERE s.status = 'failed' AND NOT EXISTS (SELECT 1 FROM sellers WHERE slug = s.name))
    ORDER BY at DESC NULLS LAST LIMIT $1`,
    [limit],
  );
  return rows;
}

export type SellerRun = {
  id: string;
  status: "running" | "succeeded" | "failed";
  attempts: number;
  observed_games: number | null;
  loaded_games: number | null;
  loaded_listings: number | null;
  failure_reason: string | null;
  started_at: Date;
  completed_at: Date | null;
  attempt_list: { no: number; status: string; error: string | null; started_at: string; completed_at: string | null }[];
};

export async function sellerRuns(slug: string, limit = 30): Promise<SellerRun[]> {
  const { rows } = await query<SellerRun>(
    `
    SELECT sr.id::text, sr.status, sr.attempts, sr.observed_games, sr.loaded_games, sr.loaded_listings,
           sr.failure_reason, sr.started_at, sr.completed_at,
           COALESCE(json_agg(json_build_object(
             'no', a.attempt_no, 'status', a.status, 'error', a.error,
             'started_at', a.started_at, 'completed_at', a.completed_at
           ) ORDER BY a.attempt_no) FILTER (WHERE a.id IS NOT NULL), '[]') AS attempt_list
    FROM scrape_runs sr
    JOIN sellers se ON se.id = sr.seller_id
    LEFT JOIN scrape_run_attempts a ON a.run_id = sr.id
    WHERE se.slug = $1
    GROUP BY sr.id ORDER BY sr.started_at DESC LIMIT $2`,
    [slug, limit],
  );
  return rows;
}

export async function stepHistory(name: string, limit = 10): Promise<(PipelineStep & { pipeline_run_id: string })[]> {
  const { rows } = await query<PipelineStep & { pipeline_run_id: string }>(
    `
    SELECT id::text, pipeline_run_id::text, name, position, status, progress_done, progress_total, message,
           log_tail, exit_code, started_at, heartbeat_at, completed_at, NULL::float AS typical_seconds
    FROM pipeline_steps WHERE name = $1 AND status <> 'queued'
    ORDER BY COALESCE(started_at, completed_at) DESC NULLS LAST LIMIT $2`,
    [name, limit],
  );
  return rows;
}

export async function sellerExists(slug: string): Promise<{ name: string; domain: string } | null> {
  const { rows } = await query<{ name: string; domain: string }>("SELECT name, domain FROM sellers WHERE slug = $1", [slug]);
  return rows[0] ?? null;
}

export type PriceUpdate = {
  listing_id: string;
  title: string;
  slug: string;
  product_type: "ACCOUNT_GAME" | "DISC" | "OWN_ACCOUNT_GAME" | string;
  tier: string | null;
  price: number;
  in_stock: boolean;
  prev_price: number | null;
  prev_in_stock: boolean | null;
  source_url: string;
};

/**
 * Every listing a seller step wrote: its price in that step versus the last
 * price recorded before the step started. price_history.scraped_at is the
 * crawl time, so it falls inside the step's [started_at, completed_at] window.
 */
export async function stepPriceUpdates(sellerSlug: string, from: Date, to: Date | null): Promise<PriceUpdate[]> {
  const { rows } = await query<PriceUpdate>(
    `
    WITH cur AS (
      SELECT DISTINCT ON (ph.listing_id) ph.listing_id, ph.price_toman, ph.in_stock
      FROM price_history ph
      JOIN listings l ON l.id = ph.listing_id
      JOIN sellers se ON se.id = l.seller_id
      WHERE se.slug = $1 AND ph.scraped_at >= $2 AND ph.scraped_at <= COALESCE($3, now())
      ORDER BY ph.listing_id, ph.scraped_at DESC
    )
    SELECT cur.listing_id::text, g.title, g.slug, l.product_type::text, l.tier::text,
           cur.price_toman::int AS price, cur.in_stock,
           prev.price_toman::int AS prev_price, prev.in_stock AS prev_in_stock, l.source_url
    FROM cur
    JOIN listings l ON l.id = cur.listing_id
    JOIN ps5_games g ON g.id = l.game_id
    LEFT JOIN LATERAL (
      SELECT price_toman, in_stock FROM price_history
      WHERE listing_id = cur.listing_id AND scraped_at < $2
      ORDER BY scraped_at DESC LIMIT 1
    ) prev ON true
    ORDER BY g.title, l.product_type, l.tier NULLS FIRST`,
    [sellerSlug, from, to],
  );
  return rows;
}

export async function getStep(runId: string, name: string): Promise<(PipelineStep & { pipeline_run_id: string }) | null> {
  if (!/^\d+$/.test(runId)) return null;
  const { rows } = await query<PipelineStep & { pipeline_run_id: string }>(
    `SELECT id::text, pipeline_run_id::text, name, position, status, progress_done, progress_total, message,
            NULL::text AS log_tail, exit_code, started_at, heartbeat_at, completed_at, NULL::float AS typical_seconds
     FROM pipeline_steps WHERE pipeline_run_id = $1 AND name = $2`,
    [runId, name],
  );
  return rows[0] ?? null;
}

// ── Seller referrals (outbound_clicks, migration 034) ────────────────────────
// "Unique" = distinct visitor per day (the visitor hash rotates daily), which is
// the defensible number to bill a shop by; raw clicks include repeat clicks.

export const RANGES = {
  day: { label: "24 hours", interval: "1 day", bucket: "hour" },
  week: { label: "7 days", interval: "7 days", bucket: "day" },
  month: { label: "30 days", interval: "30 days", bucket: "day" },
  year: { label: "12 months", interval: "1 year", bucket: "month" },
  all: { label: "All time", interval: null, bucket: "month" },
} as const;
export type RangeKey = keyof typeof RANGES;

const rangeWhere = (range: RangeKey, alias = "c") =>
  RANGES[range].interval ? `${alias}.clicked_at > now() - interval '${RANGES[range].interval}'` : "true";

export type SellerReferrals = {
  slug: string;
  name: string;
  domain: string;
  clicks: number;
  unique_visitors: number;
  games: number;
  last_click: Date | null;
};

export async function referralsBySeller(range: RangeKey): Promise<SellerReferrals[]> {
  const { rows } = await query<SellerReferrals>(`
    SELECT se.slug, se.name, se.domain,
           COUNT(c.id)::int AS clicks,
           -- FILTER: a row value of the outer join's NULLs is itself not NULL and would count as 1.
           COUNT(DISTINCT (c.visitor_hash, (c.clicked_at AT TIME ZONE 'Asia/Tehran')::date)) FILTER (WHERE c.id IS NOT NULL)::int AS unique_visitors,
           COUNT(DISTINCT c.game_id)::int AS games,
           MAX(c.clicked_at) AS last_click
    FROM sellers se
    LEFT JOIN outbound_clicks c ON c.seller_id = se.id AND ${rangeWhere(range)}
    GROUP BY se.id
    ORDER BY clicks DESC, se.name`);
  return rows;
}

export type GameReferrals = {
  slug: string;
  title: string;
  clicks: number;
  unique_visitors: number;
  sellers: number;
  last_click: Date;
};

export async function referralsByGame(range: RangeKey, sellerSlug: string | null, limit = 200): Promise<GameReferrals[]> {
  const { rows } = await query<GameReferrals>(
    `
    SELECT g.slug, g.title,
           COUNT(*)::int AS clicks,
           COUNT(DISTINCT (c.visitor_hash, (c.clicked_at AT TIME ZONE 'Asia/Tehran')::date))::int AS unique_visitors,
           COUNT(DISTINCT c.seller_id)::int AS sellers,
           MAX(c.clicked_at) AS last_click
    FROM outbound_clicks c
    JOIN ps5_games g ON g.id = c.game_id
    WHERE ${rangeWhere(range)} AND ($1::text IS NULL OR c.seller_id = (SELECT id FROM sellers WHERE slug = $1))
    GROUP BY g.id
    ORDER BY clicks DESC, g.title
    LIMIT $2`,
    [sellerSlug, limit],
  );
  return rows;
}

/** bucket is Tehran wall-clock text ("2026-10-20" / "2026-10-20 14:00" / "2026-10"), never a Date, so no timezone shift. */
export type ClickBucket = { bucket: string; clicks: number; unique_visitors: number };

export async function referralTrend(range: RangeKey, sellerSlug: string | null): Promise<ClickBucket[]> {
  const unit = RANGES[range].bucket;
  const { rows } = await query<ClickBucket>(
    `
    SELECT to_char(date_trunc('${unit}', c.clicked_at AT TIME ZONE 'Asia/Tehran'), '${unit === "hour" ? "YYYY-MM-DD HH24:00" : unit === "day" ? "YYYY-MM-DD" : "YYYY-MM"}') AS bucket,
           COUNT(*)::int AS clicks,
           COUNT(DISTINCT (c.visitor_hash, (c.clicked_at AT TIME ZONE 'Asia/Tehran')::date))::int AS unique_visitors
    FROM outbound_clicks c
    WHERE ${rangeWhere(range)} AND ($1::text IS NULL OR c.seller_id = (SELECT id FROM sellers WHERE slug = $1))
    GROUP BY 1 ORDER BY 1`,
    [sellerSlug],
  );
  return rows;
}

export type ReferralExportRow = {
  seller: string;
  game: string;
  product_type: string;
  tier: string | null;
  clicks: number;
  unique_visitors: number;
  first_click: Date;
  last_click: Date;
};

export async function referralExport(range: RangeKey, sellerSlug: string | null): Promise<ReferralExportRow[]> {
  const { rows } = await query<ReferralExportRow>(
    `
    SELECT se.name AS seller, g.title AS game, c.product_type::text, c.tier::text,
           COUNT(*)::int AS clicks,
           COUNT(DISTINCT (c.visitor_hash, (c.clicked_at AT TIME ZONE 'Asia/Tehran')::date))::int AS unique_visitors,
           MIN(c.clicked_at) AS first_click, MAX(c.clicked_at) AS last_click
    FROM outbound_clicks c
    JOIN sellers se ON se.id = c.seller_id
    JOIN ps5_games g ON g.id = c.game_id
    WHERE ${rangeWhere(range)} AND ($1::text IS NULL OR se.slug = $1)
    GROUP BY se.name, g.title, c.product_type, c.tier
    ORDER BY se.name, clicks DESC`,
    [sellerSlug],
  );
  return rows;
}
