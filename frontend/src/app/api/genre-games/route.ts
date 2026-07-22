import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { s3CoverUrl } from "@/lib/covers";

export async function GET(request: NextRequest) {
  const genre = request.nextUrl.searchParams.get("genre")?.trim() ?? "";
  if (!genre) return NextResponse.json([]);

  const { rows } = await query<{
    slug: string;
    title: string;
    cover_url: string | null;
    store_count: string;
  }>(`
    WITH latest AS (
      SELECT DISTINCT ON (listing_id) listing_id, price_toman
      FROM price_history ORDER BY listing_id, scraped_at DESC
    )
    SELECT g.slug, g.title, g.cover_url, COUNT(DISTINCT l.seller_id) AS store_count
    FROM games g
    JOIN listings l ON l.game_id = g.id AND l.is_active
    JOIN latest ON latest.listing_id = l.id
    WHERE g.genre_label ILIKE $1
      AND g.platform_id = (SELECT id FROM platforms WHERE slug = 'ps5')
    GROUP BY g.id
    ORDER BY store_count DESC
    LIMIT 6
  `, [`%${genre}%`]);

  return NextResponse.json(rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    coverUrl: r.cover_url?.includes("gs3.gamexs.ir") ? r.cover_url : s3CoverUrl(r.slug),
  })));
}
