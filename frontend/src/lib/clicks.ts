import { createHash, randomUUID } from "node:crypto";
import { query } from "./db";

// Seller referral tracking for /go/[listingId] (migration 034). Server-only.

export type RedirectTarget = {
  listing_id: number;
  game_id: number;
  seller_id: number;
  product_type: "ACCOUNT_GAME" | "OWN_ACCOUNT_GAME" | "DISC";
  tier: "CAPACITY_1" | "CAPACITY_2" | "CAPACITY_3" | null;
  source_url: string;
  seller_name: string;
  seller_domain: string;
  game_title: string;
  game_slug: string;
  price_toman: number | null;
  in_stock: boolean | null;
};

export async function getRedirectTarget(listingId: string): Promise<RedirectTarget | null> {
  if (!/^\d{1,10}$/.test(listingId)) return null;
  const { rows } = await query<RedirectTarget>(
    `
    SELECT l.id AS listing_id, l.game_id, l.seller_id, l.product_type, l.tier, l.source_url,
           s.name AS seller_name, s.domain AS seller_domain, g.title AS game_title, g.slug AS game_slug,
           latest.price_toman::int AS price_toman, latest.in_stock
    FROM listings l
    JOIN sellers s ON s.id = l.seller_id
    JOIN ps5_games g ON g.id = l.game_id
    LEFT JOIN LATERAL (
      SELECT price_toman, in_stock FROM price_history WHERE listing_id = l.id ORDER BY scraped_at DESC LIMIT 1
    ) latest ON true
    WHERE l.id = $1`,
    [listingId],
  );
  const target = rows[0];
  // Only ever redirect to the seller's own site: the URL comes from the
  // scraper, but a bad row must not turn /go into an open redirect.
  if (!target || !isSellerUrl(target.source_url, target.seller_domain)) return null;
  return target;
}

export function isSellerUrl(url: string, domain: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    const host = hostname.replace(/^www\./, "");
    const seller = domain.replace(/^www\./, "");
    return (protocol === "https:" || protocol === "http:") && (host === seller || host.endsWith(`.${seller}`));
  } catch {
    return false;
  }
}

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|lighthouse|curl|wget|python|httpclient/i;

/** Prefetches and crawlers render the page too; neither is a customer. */
export function isCountable(headers: Headers): boolean {
  const purpose = headers.get("sec-purpose") ?? headers.get("purpose") ?? "";
  if (/prefetch|prerender/i.test(purpose) || headers.has("next-router-prefetch")) return false;
  const ua = headers.get("user-agent") ?? "";
  return ua.length > 0 && !BOT_UA.test(ua);
}

/** The visitor's IP: ArvanCloud's ar-real-ip, else the first X-Forwarded-For hop. */
export function clientIp(headers: Headers): string {
  return headers.get("ar-real-ip")?.trim() || (headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || headers.get("x-real-ip") || "";
}

export function visitorHash(headers: Headers, now: Date = new Date()): string {
  const ip = clientIp(headers);
  const day = now.toISOString().slice(0, 10);
  const salt = process.env.CLICK_HASH_SALT ?? "gamexs-clicks";
  return createHash("sha256").update(`${ip}|${headers.get("user-agent") ?? ""}|${day}|${salt}`).digest("hex").slice(0, 32);
}

/**
 * Best-effort: a tracking failure must never block the customer's redirect.
 * Returns the click id + one-time token the page hands to the browser so it can
 * attach the logged-in user (see app/api/clicks/route.ts), or null.
 */
export async function recordClick(target: RedirectTarget, headers: Headers): Promise<{ id: string; token: string } | null> {
  if (!isCountable(headers)) return null;
  const referrer = headers.get("referer");
  let referrerPath: string | null = null;
  try {
    referrerPath = referrer ? new URL(referrer).pathname.slice(0, 300) : null;
  } catch {}
  const ip = clientIp(headers);
  const token = randomUUID();
  const { rows } = await query<{ id: string }>(
    `INSERT INTO outbound_clicks (listing_id, game_id, seller_id, product_type, tier, price_toman, visitor_hash, referrer, ip_address, user_agent, claim_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::inet, $10, $11)
     RETURNING id::text AS id`,
    [target.listing_id, target.game_id, target.seller_id, target.product_type, target.tier, target.price_toman,
     visitorHash(headers), referrerPath, /^[0-9a-f.:]+$/i.test(ip) ? ip : null, (headers.get("user-agent") ?? "").slice(0, 400), token],
  ).catch((error) => {
    console.error("outbound click not recorded", error);
    return { rows: [] as { id: string }[] };
  });
  return rows[0] ? { id: rows[0].id, token } : null;
}
