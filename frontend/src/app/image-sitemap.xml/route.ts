import { listGames } from "@/lib/games-repo";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" }[character]!));
}

export async function GET() {
  const games = await listGames();
  const urls = games.map((game) => {
    const images = [game.coverUrl, game.screenshotUrl].filter((value): value is string => Boolean(value));
    if (!images.length) return "";
    return `<url><loc>https://gamexs.ir/games/${encodeURIComponent(game.slug)}</loc>${images
      .map((image) => `<image:image><image:loc>${escapeXml(image)}</image:loc><image:title>${escapeXml(game.title)}</image:title></image:image>`)
      .join("")}</url>`;
  }).filter(Boolean).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls}</urlset>`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
