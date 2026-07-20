import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AiGame { name: string; description: string }

interface CatalogRow {
  slug: string;
  title: string;
  genre_label: string | null;
  cover_url: string | null;
  lowest_price: string | null;
  store_count: string;
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(gameTitle: string): string {
  return `Here is a PS5 game that I like very much: "${gameTitle}"
This game is so fantastic based on my personal preferences and experiences and I want to experience similar games according to this game. I need top 5 PS5 games that have been released and are very similar to this game based on user experience and type of game. Give me a list of 5 PS5 games that have these features.

Give me the output in exactly this format with no introduction or conclusion:

1. [Game Name]
description: [a simple 2 line description of that game in Persian language]

2. [Game Name]
description: [a simple 2 line description of that game in Persian language]

3. [Game Name]
description: [a simple 2 line description of that game in Persian language]

4. [Game Name]
description: [a simple 2 line description of that game in Persian language]

5. [Game Name]
description: [a simple 2 line description of that game in Persian language]`;
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseGameEntry(text: string): AiGame | null {
  const nameMatch = text.match(/^\*{0,2}\d+\.\s*\*{0,2}(.+?)\*{0,2}\s*$/m);
  const descMatch = text.match(/descri[bp]ti?on[:\s]+([\s\S]+)/i);
  if (!nameMatch) return null;
  const name = nameMatch[1].trim().replace(/\*/g, "");
  const description = descMatch
    ? descMatch[1].trim().replace(/\n+/g, " ").replace(/\*/g, "")
    : "";
  return name ? { name, description } : null;
}

// Try to extract newly complete game entries from accumulated text.
// Returns { games, remaining } where remaining is unprocessed tail.
function extractCompleteGames(
  accumulated: string,
  alreadyExtracted: number
): { games: AiGame[]; remaining: string } {
  const games: AiGame[] = [];
  let text = accumulated;

  for (let n = alreadyExtracted + 1; n <= 5; n++) {
    const nextN = n + 1;
    // Current entry must start here (after trimming)
    if (!/^\s*\*{0,2}\d+\./.test(text)) break;

    if (n < 5) {
      // Complete when the NEXT game number appears
      const nextPattern = new RegExp(`\n\\s*\\*{0,2}${nextN}\\.`);
      const nextMatch = nextPattern.exec(text);
      if (!nextMatch) break; // still streaming this entry

      const game = parseGameEntry(text.slice(0, nextMatch.index).trim());
      if (!game) break;
      games.push(game);
      text = text.slice(nextMatch.index).trim();
    } else {
      // Last game — complete only at end of stream (caller passes full text)
      const game = parseGameEntry(text.trim());
      if (game) { games.push(game); text = ""; }
    }
  }

  return { games, remaining: text };
}

// ── Fuzzy matching ────────────────────────────────────────────────────────────

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

function findBestMatch(aiName: string, catalog: CatalogRow[]): CatalogRow | null {
  let best: CatalogRow | null = null;
  let bestScore = 0;
  for (const row of catalog) {
    const s = matchScore(aiName, row.title);
    if (s > bestScore) { bestScore = s; best = row; }
  }
  return bestScore >= 0.4 ? best : null;
}

function enrichResult(game: AiGame, catalog: CatalogRow[]) {
  const row = findBestMatch(game.name, catalog);
  return {
    aiName: game.name,
    aiDescription: game.description,
    slug: row?.slug ?? null,
    title: row?.title ?? game.name,
    genreLabel: row?.genre_label ?? null,
    coverUrl: row?.cover_url ?? null,
    lowestPriceToman: row?.lowest_price != null ? Number(row.lowest_price) : null,
    storeCount: row ? Number(row.store_count) : 0,
    matched: !!row,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const searchParam = request.nextUrl.searchParams.get("search");
  const gameParam   = request.nextUrl.searchParams.get("game");

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

  // ── AI recommendations (SSE streaming) ────────────────────────────────────
  if (gameParam !== null) {
    const slug = gameParam.trim();
    if (!slug) return NextResponse.json([]);

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENROUTER_API_KEY not set" }, { status: 500 });

    // Fetch seed title
    const { rows: seedRows } = await query<{ title: string }>(
      `SELECT title FROM games WHERE slug = $1`, [slug]
    );
    const gameTitle = seedRows[0]?.title;
    if (!gameTitle) return NextResponse.json([]);

    // Pre-fetch full enriched catalog (18ms — done once, matched in-memory per game)
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
       GROUP BY g.id`
    );

    // Build SSE ReadableStream
    const encoder = new TextEncoder();
    let openRouterAbort: AbortController | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: object | string) => {
          const data = typeof payload === "string" ? payload : JSON.stringify(payload);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        try {
          openRouterAbort = new AbortController();
          const timeoutId = setTimeout(() => openRouterAbort?.abort(), 45_000);

          let orRes: Response;
          try {
            orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://gamexs.ir",
                "X-Title": "GameXS",
              },
              body: JSON.stringify({
                model: "openrouter/free",
                messages: [{ role: "user", content: buildPrompt(gameTitle) }],
                stream: true,
              }),
              cache: "no-store",
              signal: openRouterAbort.signal,
            });
          } finally {
            clearTimeout(timeoutId);
          }

          if (!orRes.ok) {
            const err = await orRes.text();
            throw new Error(`OpenRouter ${orRes.status}: ${err}`);
          }

          // Consume OpenRouter SSE stream
          const reader = orRes.body!.getReader();
          const dec = new TextDecoder();
          let lineBuf = "";
          let accumulated = "";
          let extracted = 0;

          outer: while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            lineBuf += dec.decode(value, { stream: true });
            const lines = lineBuf.split("\n");
            lineBuf = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const chunk = trimmed.slice(5).trim();
              if (chunk === "[DONE]") break outer;

              try {
                const parsed = JSON.parse(chunk);
                const delta: string = parsed.choices?.[0]?.delta?.content ?? "";
                if (!delta) continue;

                accumulated += delta;

                // Try to emit newly complete games (all except the last)
                const { games, remaining } = extractCompleteGames(accumulated, extracted);
                for (const game of games) {
                  const result = enrichResult(game, catalog);
                  if (result.matched) send(result);
                  extracted++;
                }
                accumulated = remaining;
              } catch { continue; }
            }
          }

          // Process the final game from whatever text remains
          if (extracted < 5 && accumulated.trim()) {
            const { games } = extractCompleteGames(accumulated + "\n6. x", extracted);
            for (const game of games) {
              const result = enrichResult(game, catalog);
              if (result.matched) send(result);
              extracted++;
            }
          }

          send("[DONE]");
        } catch (err) {
          console.error("Recommendation stream error:", err instanceof Error ? err.message : err);
          send({ error: "AI service unavailable" });
        } finally {
          controller.close();
        }
      },
      cancel() {
        openRouterAbort?.abort();
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
