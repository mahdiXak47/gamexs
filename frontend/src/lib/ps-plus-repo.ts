import { query } from "./db";

export type PsPlusTier = "ESSENTIAL" | "EXTRA" | "PREMIUM";
export type PsPlusCapacity = "CAPACITY_1" | "CAPACITY_2" | "CAPACITY_3";

export interface PsPlusOption {
  id: number;
  capacity: PsPlusCapacity;
  sellerName: string;
  sellerSlug: string;
  sourceUrl: string;
  latestPrice: number | null;
  inStock: boolean;
}

export interface PsPlusPlan {
  tier: PsPlusTier;
  coverUrl: string | null;
  isActive: boolean;
  options: PsPlusOption[];
}

export const TIER_SLUG: Record<PsPlusTier, string> = {
  ESSENTIAL: "essential",
  EXTRA:     "extra",
  PREMIUM:   "premium",
};

export const SLUG_TIER: Record<string, PsPlusTier> = {
  essential: "ESSENTIAL",
  extra:     "EXTRA",
  premium:   "PREMIUM",
};

export const CAPACITY_LABEL: Record<PsPlusCapacity, string> = {
  CAPACITY_1: "ظرفیت کامل",
  CAPACITY_2: "ظرفیت ۲",
  CAPACITY_3: "ظرفیت ۳",
};

export const CAPACITY_DESC: Record<PsPlusCapacity, string> = {
  CAPACITY_1: "اطلاعات کامل اکانت تحویل داده می‌شود یا اشتراک روی حساب خودتان فعال می‌شود",
  CAPACITY_2: "اکانت اشتراکی — آنلاین و آفلاین قابل استفاده است",
  CAPACITY_3: "اکانت اشتراکی — فقط حالت آنلاین",
};

export const TIER_LABEL: Record<PsPlusTier, string> = {
  ESSENTIAL: "PS Plus Essential",
  EXTRA:     "PS Plus Extra",
  PREMIUM:   "PS Plus Premium",
};

export const TIER_COLOR: Record<PsPlusTier, string> = {
  ESSENTIAL: "#2d68c4",
  EXTRA:     "#003087",
  PREMIUM:   "#1a1a2e",
};

// Returns all tiers with their latest price per capacity option.
export async function getAllPsPlusPlans(): Promise<PsPlusPlan[]> {
  const { rows } = await query<{
    tier: PsPlusTier;
    cover_url: string | null;
    is_active: boolean;
    id: number;
    capacity: PsPlusCapacity;
    seller_name: string;
    seller_slug: string;
    source_url: string;
    latest_price: string | null;
    in_stock: boolean;
  }>(`
    WITH latest AS (
      SELECT DISTINCT ON (ps_plus_id)
        ps_plus_id, price_toman, in_stock
      FROM ps_plus_price_history
      ORDER BY ps_plus_id, scraped_at DESC
    )
    SELECT
      pp.tier,
      pp.cover_url,
      pp.is_active,
      pp.id,
      pp.capacity,
      s.name  AS seller_name,
      s.slug  AS seller_slug,
      pp.source_url,
      latest.price_toman AS latest_price,
      COALESCE(latest.in_stock, false) AS in_stock
    FROM ps_plus pp
    JOIN sellers s ON s.id = pp.seller_id
    LEFT JOIN latest ON latest.ps_plus_id = pp.id
    ORDER BY
      CASE pp.tier
        WHEN 'ESSENTIAL' THEN 1
        WHEN 'EXTRA'     THEN 2
        WHEN 'PREMIUM'   THEN 3
      END,
      CASE pp.capacity
        WHEN 'CAPACITY_3' THEN 1
        WHEN 'CAPACITY_2' THEN 2
        WHEN 'CAPACITY_1' THEN 3
      END
  `);

  const planMap = new Map<PsPlusTier, PsPlusPlan>();
  for (const row of rows) {
    if (!planMap.has(row.tier)) {
      planMap.set(row.tier, {
        tier: row.tier,
        coverUrl: row.cover_url,
        isActive: row.is_active,
        options: [],
      });
    }
    planMap.get(row.tier)!.options.push({
      id: row.id,
      capacity: row.capacity,
      sellerName: row.seller_name,
      sellerSlug: row.seller_slug,
      sourceUrl: row.source_url,
      latestPrice: row.latest_price != null ? Number(row.latest_price) : null,
      inStock: row.in_stock,
    });
  }

  return Array.from(planMap.values());
}

export async function getPsPlusPlan(tier: PsPlusTier): Promise<PsPlusPlan | null> {
  const all = await getAllPsPlusPlans();
  return all.find((p) => p.tier === tier) ?? null;
}
