import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { s3CoverUrl } from "@/lib/covers";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const { rows } = await query<{
    slug: string;
    title: string;
    cover_url: string | null;
    genre_label: string | null;
    lowest_price: string | null;
  }>(
    `
    WITH latest AS (
      SELECT DISTINCT ON (listing_id) listing_id, price_toman
      FROM price_history ORDER BY listing_id, scraped_at DESC
    )
    SELECT
      g.slug,
      g.title,
      g.cover_url,
      g.genre_label,
      MIN(latest.price_toman) AS lowest_price
    FROM games g
    LEFT JOIN listings l ON l.game_id = g.id AND l.is_active
    LEFT JOIN latest ON latest.listing_id = l.id
    WHERE g.title ILIKE $1
      AND g.platform_id = (SELECT id FROM platforms WHERE slug = 'ps5')
    GROUP BY g.id
    ORDER BY g.title
    LIMIT 8
    `,
    [`%${q}%`]
  );

  return NextResponse.json(
    rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      coverUrl: r.cover_url?.includes("gs3.gamexs.ir") ? r.cover_url : s3CoverUrl(r.slug),
      genreLabel: r.genre_label,
      lowestPriceToman: r.lowest_price ? Number(r.lowest_price) : null,
    }))
  );
}
