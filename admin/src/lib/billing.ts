import { query } from "./db";
import { RANGES, type RangeKey } from "./queries";

// CPC billing reports. Writes (classification, invoices, payments) happen in the
// Django backend (apps/billing); this app only reads billing_* and outbound_clicks.

export const VALIDITY = ["valid", "duplicate", "suspicious", "invalid", "unverifiable", "pending"] as const;
export type Validity = (typeof VALIDITY)[number];
export const VALIDITY_LABEL: Record<Validity, string> = {
  valid: "Valid",
  duplicate: "Duplicate",
  suspicious: "Suspicious (held)",
  invalid: "Invalid",
  unverifiable: "Unverifiable",
  pending: "Not yet checked",
};

export const LINE_LABEL: Record<string, string> = {
  charged: "Charged at full rate",
  discounted: "Discounted",
  free: "Free (promotion)",
  over_cap: "Over spending cap (not charged)",
};

export type InvoiceRow = {
  id: number;
  seller_id: number;
  seller_name: string;
  seller_slug: string;
  period: string;
  status: "draft" | "issued" | "paid" | "void";
  raw_clicks: number;
  valid_clicks: number;
  invalid_clicks: Record<string, number>;
  billable_clicks: number;
  free_clicks: number;
  discounted_clicks: number;
  over_cap_clicks: number;
  gross_toman: number;
  per_click_discount_toman: number;
  total_discount_toman: number;
  total_campaign_name: string | null;
  payable_toman: number;
  rules: Record<string, number | boolean>;
  issued_at: Date | null;
  paid_at: Date | null;
};

const INVOICE_SELECT = `
  SELECT i.id::int, i.seller_id::int, se.name AS seller_name, se.slug AS seller_slug, i.period, i.status,
         i.raw_clicks, i.valid_clicks, i.invalid_clicks, i.billable_clicks, i.free_clicks, i.discounted_clicks,
         i.over_cap_clicks, i.gross_toman::float8 AS gross_toman, i.per_click_discount_toman::float8 AS per_click_discount_toman,
         i.total_discount_toman::float8 AS total_discount_toman, c.name AS total_campaign_name,
         i.payable_toman::float8 AS payable_toman, i.rules, i.issued_at, i.paid_at
  FROM billing_invoice i
  JOIN sellers se ON se.id = i.seller_id
  LEFT JOIN billing_campaign c ON c.id = i.total_campaign_id`;

export async function billingPeriods(sellerId: number | null = null): Promise<string[]> {
  const { rows } = await query<{ period: string }>(
    `SELECT DISTINCT period FROM billing_invoice WHERE ($1::int IS NULL OR seller_id = $1) ORDER BY period DESC`,
    [sellerId],
  );
  return rows.map((r) => r.period);
}

/** Staff: every store's invoice for a period. Store portal: pass the store's id (drafts hidden). */
export async function invoices(period: string | null, sellerId: number | null = null): Promise<InvoiceRow[]> {
  const { rows } = await query<InvoiceRow>(
    `${INVOICE_SELECT}
     WHERE ($1::text IS NULL OR i.period = $1)
       AND ($2::int IS NULL OR (i.seller_id = $2 AND i.status <> 'draft'))
     ORDER BY i.period DESC, i.payable_toman DESC, se.name`,
    [period, sellerId],
  );
  return rows;
}

export async function invoice(id: number): Promise<InvoiceRow | null> {
  const { rows } = await query<InvoiceRow>(`${INVOICE_SELECT} WHERE i.id = $1`, [id]);
  return rows[0] ?? null;
}

export type InvoiceLineRow = {
  kind: string;
  campaign_name: string | null;
  clicks: number;
  base_rate_toman: number;
  percent_off: number;
  gross_toman: number;
  discount_toman: number;
  amount_toman: number;
};

export async function invoiceLines(invoiceId: number): Promise<InvoiceLineRow[]> {
  const { rows } = await query<InvoiceLineRow>(
    `SELECT l.kind, c.name AS campaign_name, l.clicks, l.base_rate_toman, l.percent_off,
            l.gross_toman::float8 AS gross_toman, l.discount_toman::float8 AS discount_toman, l.amount_toman::float8 AS amount_toman
     FROM billing_invoiceline l LEFT JOIN billing_campaign c ON c.id = l.campaign_id
     WHERE l.invoice_id = $1 ORDER BY l.id`,
    [invoiceId],
  );
  return rows;
}

export type InvoiceClickRow = { clicked_at: Date; game: string; product_type: string; tier: string | null; kind: string; amount_toman: number };

/** One row per billed click, for the invoice CSV (what a store checks against its own logs). */
export async function invoiceClicks(invoiceId: number): Promise<InvoiceClickRow[]> {
  const { rows } = await query<InvoiceClickRow>(
    `SELECT c.clicked_at, g.title AS game, c.product_type::text, c.tier::text, l.kind,
            round(l.amount_toman::numeric / NULLIF(l.clicks, 0), 2)::float8 AS amount_toman
     FROM billing_clickcharge cc
     JOIN billing_invoiceline l ON l.id = cc.line_id
     JOIN outbound_clicks c ON c.id = cc.click_id
     JOIN ps5_games g ON g.id = c.game_id
     WHERE cc.invoice_id = $1
     ORDER BY c.clicked_at`,
    [invoiceId],
  );
  return rows;
}

export type ValidityCounts = Record<Validity, number> & { total: number };

const VALIDITY_COLUMNS = VALIDITY.map((v) => `COUNT(*) FILTER (WHERE c.validity = '${v}')::int AS ${v}`).join(", ");
const rangeWhere = (range: RangeKey) => (RANGES[range].interval ? `c.clicked_at > now() - interval '${RANGES[range].interval}'` : "true");

/** Click validity per store slug (staff Referrals page). */
export async function validityBySeller(range: RangeKey): Promise<Map<string, ValidityCounts>> {
  const { rows } = await query<ValidityCounts & { slug: string }>(
    `SELECT se.slug, COUNT(*)::int AS total, ${VALIDITY_COLUMNS}
     FROM outbound_clicks c JOIN sellers se ON se.id = c.seller_id WHERE ${rangeWhere(range)} GROUP BY se.slug`,
  );
  return new Map(rows.map((r) => [r.slug, r]));
}

/** One store's traffic in a range, by validity. */
export async function storeTraffic(sellerId: number, range: RangeKey): Promise<ValidityCounts> {
  const { rows } = await query<ValidityCounts>(
    `SELECT COUNT(*)::int AS total, ${VALIDITY_COLUMNS} FROM outbound_clicks c WHERE c.seller_id = $1 AND ${rangeWhere(range)}`,
    [sellerId],
  );
  return rows[0];
}

export type StoreGameRow = { slug: string; title: string; clicks: number; valid: number; last_click: Date };

export async function storeGames(sellerId: number, range: RangeKey, limit = 100): Promise<StoreGameRow[]> {
  const { rows } = await query<StoreGameRow>(
    `SELECT g.slug, g.title, COUNT(*)::int AS clicks, COUNT(*) FILTER (WHERE c.validity = 'valid')::int AS valid, MAX(c.clicked_at) AS last_click
     FROM outbound_clicks c JOIN ps5_games g ON g.id = c.game_id
     WHERE c.seller_id = $1 AND ${rangeWhere(range)}
     GROUP BY g.id ORDER BY clicks DESC, g.title LIMIT $2`,
    [sellerId, limit],
  );
  return rows;
}

export type LedgerRow = { id: number; kind: string; amount_toman: number; note: string; period: string | null; created_at: Date };

export async function ledger(sellerId: number): Promise<LedgerRow[]> {
  const { rows } = await query<LedgerRow>(
    `SELECT e.id::int, e.kind, e.amount_toman::float8 AS amount_toman, e.note, i.period, e.created_at
     FROM billing_ledgerentry e LEFT JOIN billing_invoice i ON i.id = e.invoice_id
     WHERE e.seller_id = $1 ORDER BY e.created_at DESC`,
    [sellerId],
  );
  return rows;
}

export type Campaign = { name: string; method: string; percent: number; click_allowance: number | null; starts_at: Date; ends_at: Date | null; used_clicks: number };

/** Promotions a store currently has, with how many of their clicks it has covered. */
export async function storeCampaigns(sellerId: number): Promise<Campaign[]> {
  const { rows } = await query<Campaign>(
    `SELECT c.name, c.method, c.percent, c.click_allowance, c.starts_at, c.ends_at,
            (SELECT COUNT(*) FROM billing_clickcharge cc JOIN billing_invoice i ON i.id = cc.invoice_id
              WHERE cc.campaign_id = c.id AND cc.live AND i.seller_id = $1 AND i.status <> 'draft')::int AS used_clicks
     FROM billing_campaign c JOIN billing_campaign_sellers cs ON cs.campaign_id = c.id
     WHERE cs.seller_id = $1 AND c.is_active AND (c.ends_at IS NULL OR c.ends_at > now())
     ORDER BY c.priority DESC, c.starts_at`,
    [sellerId],
  );
  return rows;
}

export async function sellerName(sellerId: number): Promise<{ name: string; domain: string } | null> {
  const { rows } = await query<{ name: string; domain: string }>(`SELECT name, domain FROM sellers WHERE id = $1`, [sellerId]);
  return rows[0] ?? null;
}

export const formatToman = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${new Intl.NumberFormat("en-US").format(Math.round(n) || 0)} T`;
