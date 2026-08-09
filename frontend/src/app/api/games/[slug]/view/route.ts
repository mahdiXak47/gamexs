import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

const VIEWER_COOKIE = "gx_viewer_id";
const VIEWER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const BOT_USER_AGENT_RE =
  /bot|crawler|spider|crawling|facebookexternalhit|google-structured-data-testing-tool|google-inspectiontool|preview|slurp|bingbot|duckduckbot|baiduspider|yandex/i;

function isLikelyBot(userAgent: string | null): boolean {
  return !userAgent || BOT_USER_AGENT_RE.test(userAgent);
}

function hashViewerId(viewerId: string): string {
  const salt = process.env.VIEW_TRACKING_SALT ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "gamexs-dev-view-salt";
  return crypto.createHash("sha256").update(`${salt}:${viewerId}`).digest("hex");
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/games/[slug]/view">) {
  try {
    if (isLikelyBot(request.headers.get("user-agent"))) {
      return NextResponse.json({ ok: true, tracked: false });
    }

    const { slug } = await ctx.params;
    const existingViewerId = request.cookies.get(VIEWER_COOKIE)?.value;
    const viewerId = existingViewerId ?? crypto.randomUUID();
    const visitorHash = hashViewerId(viewerId);

    const { rows } = await query<{ found: boolean; unique_view: boolean }>(
      `
      WITH game AS (
        SELECT id
        FROM ps5_games
        WHERE slug = $1
          AND platform_id = (SELECT id FROM platforms WHERE slug = 'ps5')
        LIMIT 1
      ),
      unique_hit AS (
        INSERT INTO game_page_view_uniques (game_id, viewed_on, visitor_hash)
        SELECT id, CURRENT_DATE, $2
        FROM game
        ON CONFLICT DO NOTHING
        RETURNING 1
      ),
      stats_upsert AS (
        INSERT INTO game_page_view_stats (game_id, total_views, unique_daily_views, last_viewed_at)
        SELECT id, 1, (SELECT COUNT(*) FROM unique_hit), now()
        FROM game
        ON CONFLICT (game_id) DO UPDATE SET
          total_views = game_page_view_stats.total_views + 1,
          unique_daily_views = game_page_view_stats.unique_daily_views + EXCLUDED.unique_daily_views,
          last_viewed_at = EXCLUDED.last_viewed_at
        RETURNING game_id
      ),
      daily_upsert AS (
        INSERT INTO game_page_view_daily (game_id, viewed_on, total_views, unique_views)
        SELECT id, CURRENT_DATE, 1, (SELECT COUNT(*) FROM unique_hit)
        FROM game
        ON CONFLICT (game_id, viewed_on) DO UPDATE SET
          total_views = game_page_view_daily.total_views + 1,
          unique_views = game_page_view_daily.unique_views + EXCLUDED.unique_views
        RETURNING game_id
      )
      SELECT
        EXISTS(SELECT 1 FROM game) AS found,
        EXISTS(SELECT 1 FROM unique_hit) AS unique_view
      `,
      [slug, visitorHash]
    );

    const result = rows[0];
    if (!result?.found) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const response = NextResponse.json({ ok: true, unique: result.unique_view });
    if (!existingViewerId) {
      response.cookies.set(VIEWER_COOKIE, viewerId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: VIEWER_COOKIE_MAX_AGE,
        path: "/",
      });
    }
    return response;
  } catch {
    // Page views are best-effort analytics; never break the game page.
    return NextResponse.json({ ok: true, tracked: false });
  }
}
