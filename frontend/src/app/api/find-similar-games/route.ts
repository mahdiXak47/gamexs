import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// ── Config ────────────────────────────────────────────────────────────────────
//
// Free OpenRouter models are capped at 20 req/min and 50 req/day *per
// OpenRouter account*, not per user (rising to 1000/day only after a one-time
// $10 credit purchase, which we're deliberately not doing). That budget is
// nowhere near enough to serve this feature live on every click for a real
// site, so the design here is: cache the AI's *game picks* in Postgres and
// only ever call the AI on a genuine cache miss. Live price/stock/cover data
// is still fetched fresh every request from `games`/`price_history` — only
// the (expensive, rate-limited, slow) "which 5 games are similar" judgment
// gets cached.
//
// PROMPT_VERSION is part of the cache key: bump it whenever MODEL or
// buildPrompt() changes so old cached picks stop being served automatically,
// without needing a manual cache-clear migration.
const MODEL = "openrouter/free";
const PROMPT_VERSION = 2;
const CACHE_TTL_DAYS = 90;
const MAX_CANDIDATES = 1200; // bounds prompt size/token cost regardless of catalog growth

// ── Types ─────────────────────────────────────────────────────────────────────

interface AiPick { title: string; similarity: number; reason: string }

interface CatalogRow {
  slug: string;
  title: string;
  genre_label: string | null;
  cover_url: string | null;
  lowest_price: string | null;
  store_count: string;
}

interface SeedGame { id: number; title: string; genre_label: string | null }

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(gameTitle: string, candidateTitles: string[]): string {
  return `You are an expert game-recommendation engine for GameXS, a PS5 price-comparison catalog.

INPUT GAME: "${gameTitle}"

CANDIDATE GAMES — this is the complete GameXS PS5 catalog. You may ONLY
recommend titles from this list, copied character-for-character:
${candidateTitles.join("\n")}

Judge similarity primarily on gameplay feel: core gameplay loop, combat
style, exploration and level design, pacing, difficulty, and tone — weigh
these far more heavily than a shared genre label or franchise name alone.

From the CANDIDATE GAMES list only, select the 5 titles that would give a
player the closest overall experience to "${gameTitle}".

Rules:
- Only select titles that appear verbatim in the candidate list above.
- Never include "${gameTitle}" itself.
- Never repeat a title.
- Rank from most to least similar.

Output ONLY valid JSON — no markdown fences, no commentary before or after —
in exactly this shape, with exactly 5 objects:
[
  {"title": "<exact candidate title>", "similarity": <integer 0-100>, "reason": "<one Persian sentence, max 25 words>"}
]`;
}

// ── Parsing ───────────────────────────────────────────────────────────────────
//
// Non-streaming on purpose: the response is a short JSON array (5 objects),
// so there's nothing meaningful to gain from token-by-token streaming, and a
// partial JSON literal isn't parseable anyway. This also removes the fragile
// incremental markdown parser the old free-text version needed.

function parseAiResponse(raw: string): AiPick[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("AI response did not contain a JSON array");
  }
  const parsed = JSON.parse(raw.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("AI response JSON was not an array");

  return parsed
    .filter(
      (item): item is AiPick =>
        item && typeof item.title === "string" && item.title.trim().length > 0
    )
    .map((item) => ({
      title: item.title.trim(),
      similarity: Number.isFinite(item.similarity) ? Math.max(0, Math.min(100, Math.round(item.similarity))) : 0,
      reason: typeof item.reason === "string" ? item.reason.trim() : "",
    }))
    .slice(0, 5);
}

// ── Fuzzy matching (safety net — candidates are catalog titles, so this
//    should almost always be an exact hit; guards against the model slightly
//    altering punctuation/casing) ────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function matchScore(aiTitle: string, dbTitle: string): number {
  const na = normalize(aiTitle);
  const nb = normalize(dbTitle);
  if (na === nb) return 1.0;
  if (na && nb && (nb.includes(na) || na.includes(nb))) return 0.85;
  const wa = na.split(" ").filter((w) => w.length > 2);
  const wb = new Set(nb.split(" ").filter((w) => w.length > 2));
  if (!wa.length || !wb.size) return 0;
  return wa.filter((w) => wb.has(w)).length / Math.max(wa.length, wb.size);
}

function findBestMatch(aiTitle: string, catalog: CatalogRow[]): CatalogRow | null {
  let best: CatalogRow | null = null;
  let bestScore = 0;
  for (const row of catalog) {
    const s = matchScore(aiTitle, row.title);
    if (s > bestScore) { bestScore = s; best = row; }
  }
  return bestScore >= 0.4 ? best : null;
}

function enrichPick(pick: AiPick, catalog: CatalogRow[]) {
  const row = findBestMatch(pick.title, catalog);
  return {
    aiName: pick.title,
    aiDescription: pick.reason,
    similarity: pick.similarity,
    slug: row?.slug ?? null,
    title: row?.title ?? pick.title,
    genreLabel: row?.genre_label ?? null,
    coverUrl: row?.cover_url ?? null,
    lowestPriceToman: row?.lowest_price != null ? Number(row.lowest_price) : null,
    storeCount: row ? Number(row.store_count) : 0,
    matched: !!row,
  };
}

// ── Cache ─────────────────────────────────────────────────────────────────────

async function getCachedPicks(gameId: number): Promise<AiPick[] | null> {
  const { rows } = await query<{ recommendations: AiPick[]; created_at: Date }>(
    `SELECT recommendations, created_at FROM ai_recommendation_cache
     WHERE game_id = $1 AND prompt_version = $2`,
    [gameId, PROMPT_VERSION]
  );
  const row = rows[0];
  if (!row) return null;
  const ageDays = (Date.now() - row.created_at.getTime()) / 86_400_000;
  if (ageDays > CACHE_TTL_DAYS) return null;
  return row.recommendations;
}

async function setCachedPicks(gameId: number, picks: AiPick[]): Promise<void> {
  await query(
    `INSERT INTO ai_recommendation_cache (game_id, prompt_version, recommendations, model)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (game_id, prompt_version)
     DO UPDATE SET recommendations = EXCLUDED.recommendations, model = EXCLUDED.model, created_at = now()`,
    [gameId, PROMPT_VERSION, JSON.stringify(picks), MODEL]
  );
}

// ── Non-AI fallback ───────────────────────────────────────────────────────────
//
// If the AI call fails (rate-limited, provider down, malformed response) and
// there's no cache to fall back on, the feature degrades to a cheap DB-only
// "same genre, most popular" query instead of showing an error. This is what
// actually guarantees the feature stays "up" regardless of AI availability —
// no prompt can guarantee that, but a fallback path can.
async function fallbackPicks(seed: SeedGame): Promise<CatalogRow[]> {
  if (!seed.genre_label) return [];
  const { rows } = await query<CatalogRow>(
    `WITH latest AS (
       SELECT DISTINCT ON (listing_id) listing_id, price_toman
       FROM price_history ORDER BY listing_id, scraped_at DESC
     )
     SELECT g.slug, g.title, g.cover_url, g.genre_label,
            MIN(latest.price_toman) AS lowest_price,
            COUNT(DISTINCT l.seller_id)::text AS store_count
     FROM games g
     LEFT JOIN listings l ON l.game_id = g.id AND l.is_active
     LEFT JOIN latest ON latest.listing_id = l.id
     WHERE g.platform_id = (SELECT id FROM platforms WHERE slug = 'ps5')
       AND g.genre_label = $1 AND g.id <> $2
     GROUP BY g.id
     ORDER BY store_count DESC
     LIMIT 5`,
    [seed.genre_label, seed.id]
  );
  return rows;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const searchParam = request.nextUrl.searchParams.get("search");
  const gameParam = request.nextUrl.searchParams.get("game");

  // ── Autocomplete ───────────────────────────────────────────────────────────
  if (searchParam !== null) {
    const q = searchParam.trim();
    if (q.length < 2) return NextResponse.json([]);

    const { rows } = await query<{
      slug: string; title: string; genre_label: string | null; cover_url: string | null;
    }>(
      `SELECT g.slug, g.title, g.genre_label, g.cover_url
       FROM games g
       WHERE g.platform_id = (SELECT id FROM platforms WHERE slug = 'ps5')
         AND g.title ILIKE $1
       ORDER BY g.title LIMIT 8`,
      [`%${q}%`]
    );

    return NextResponse.json(rows.map((r) => ({
      slug: r.slug, title: r.title, genreLabel: r.genre_label, coverUrl: r.cover_url,
    })));
  }

  // ── AI recommendations (SSE) ─────────────────────────────────────────────
  if (gameParam !== null) {
    const slug = gameParam.trim();
    if (!slug) return NextResponse.json([]);

    const { rows: seedRows } = await query<SeedGame>(
      `SELECT id, title, genre_label FROM games WHERE slug = $1`, [slug]
    );
    const seed = seedRows[0];
    if (!seed) return NextResponse.json([]);

    // Full catalog snapshot — used both as candidate list for the prompt and
    // to enrich AI picks (or the cached ones) with live price/cover/stock.
    const { rows: catalog } = await query<CatalogRow>(
      `WITH latest AS (
         SELECT DISTINCT ON (listing_id) listing_id, price_toman
         FROM price_history ORDER BY listing_id, scraped_at DESC
       )
       SELECT g.slug, g.title, g.cover_url, g.genre_label,
              MIN(latest.price_toman) AS lowest_price,
              COUNT(DISTINCT l.seller_id)::text AS store_count
       FROM games g
       LEFT JOIN listings l ON l.game_id = g.id AND l.is_active
       LEFT JOIN latest ON latest.listing_id = l.id
       WHERE g.platform_id = (SELECT id FROM platforms WHERE slug = 'ps5')
       GROUP BY g.id
       ORDER BY store_count DESC`
    );

    const encoder = new TextEncoder();
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: object | string) => {
          const data = typeof payload === "string" ? payload : JSON.stringify(payload);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        try {
          let picks = await getCachedPicks(seed.id);

          if (!picks) {
            try {
              picks = await fetchAiPicks(seed.title, catalog);
              await setCachedPicks(seed.id, picks);
            } catch (err) {
              console.error("AI recommendation failed, using fallback:", err instanceof Error ? err.message : err);
              const fb = await fallbackPicks(seed);
              for (const row of fb) {
                send({
                  aiName: row.title,
                  aiDescription: "",
                  similarity: null,
                  slug: row.slug,
                  title: row.title,
                  genreLabel: row.genre_label,
                  coverUrl: row.cover_url,
                  lowestPriceToman: row.lowest_price != null ? Number(row.lowest_price) : null,
                  storeCount: Number(row.store_count),
                  matched: true,
                });
                await wait(150);
              }
              send("[DONE]");
              return;
            }
          }

          for (const pick of picks) {
            const result = enrichPick(pick, catalog);
            if (result.matched) send(result);
            await wait(150); // small stagger — keeps the "cards arrive one by one" UX even on a cache hit
          }
          send("[DONE]");
        } catch (err) {
          console.error("Recommendation stream error:", err instanceof Error ? err.message : err);
          send({ error: "AI service unavailable" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  return NextResponse.json({ error: "Missing search or game param" }, { status: 400 });
}

// ── AI call ───────────────────────────────────────────────────────────────────

async function fetchAiPicks(gameTitle: string, catalog: CatalogRow[]): Promise<AiPick[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const candidateTitles = catalog
    .map((c) => c.title)
    .filter((t) => t !== gameTitle)
    .slice(0, MAX_CANDIDATES);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);

  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://gamexs.ir",
        "X-Title": "GameXS",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: buildPrompt(gameTitle, candidateTitles) }],
        stream: false,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Empty AI response");

  return parseAiResponse(content);
}