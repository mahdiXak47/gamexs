import { listGames } from "@/lib/games-repo";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" }[character]!));
}

export async function GET() {
  // Merchant Center eligibility for a comparison-only site must be confirmed
  // before exposing/submitting this feed. Keep it dark by default.
  if (process.env.MERCHANT_FEED_ENABLED !== "true") {
    return new Response("Merchant feed is disabled", { status: 404 });
  }

  const games = await listGames();
  const items = games
    .filter((game) => game.lowestPriceToman !== null && game.coverUrl)
    .map((game) => `<item>
      <g:id>${escapeXml(game.slug)}</g:id>
      <g:title>${escapeXml(game.title)}</g:title>
      <g:description>${escapeXml(`مقایسه قیمت ${game.title} برای PS5 در GameXS؛ خرید نهایی از سایت فروشنده انجام می‌شود.`)}</g:description>
      <link>${SITE_URL}/games/${encodeURIComponent(game.slug)}</link>
      <g:image_link>${escapeXml(game.coverUrl!)}</g:image_link>
      <g:availability>in stock</g:availability>
      <g:price>${game.lowestPriceToman! * 10} IRR</g:price>
      <g:condition>new</g:condition>
      ${game.publisher ? `<g:brand>${escapeXml(game.publisher)}</g:brand>` : ""}
    </item>`)
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>
    <title>GameXS PS5 price comparison</title>
    <link>${SITE_URL}</link>
    <description>GameXS catalog feed; checkout occurs on linked seller sites.</description>
    ${items}
  </channel></rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400",
    },
  });
}
