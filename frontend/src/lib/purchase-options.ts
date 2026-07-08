import type { AccessTier, Game, ProductType, PurchaseOption } from "./types";

// Fixed display copy for each (product_type, tier) combination the taxonomy
// supports — same 5 categories regardless of whether a given game actually
// has offers in all of them (see emptyPurchaseOptions).
const CANONICAL_OPTIONS: Omit<PurchaseOption, "offers">[] = [
  {
    type: "ACCOUNT_GAME",
    tier: "CAPACITY_1",
    label: "اکانت ظرفیت ۱",
    subtitle: "اشتراکی · فقط آفلاین",
    description:
      "اکانت اشتراکی؛ پس از دریافت اطلاعات ورود، ۴۸ ساعت فرصت دارید وارد شوید و بازی را دانلود کنید. پس از دانلود، کنسول باید همیشه آفلاین بماند.",
  },
  {
    type: "ACCOUNT_GAME",
    tier: "CAPACITY_2",
    label: "اکانت ظرفیت ۲",
    subtitle: "اشتراکی · روی اکانت خودتان",
    description:
      "بازی روی اکانت PSN خودتان فعال می‌شود؛ می‌توانید هم آنلاین و هم آفلاین بازی کنید و اکانتتان کاملاً در اختیار خودتان است.",
  },
  {
    type: "ACCOUNT_GAME",
    tier: "CAPACITY_3",
    label: "اکانت ظرفیت ۳",
    subtitle: "اشتراکی · اکانت فروشگاه",
    description:
      "بازی فقط از طریق اکانت ارسالی فروشگاه قابل اجراست؛ باید با همان اکانت وارد شوید و بازی را اجرا کنید.",
  },
  {
    type: "OWN_ACCOUNT_GAME",
    label: "روی اکانت شما",
    subtitle: "کد دیجیتال",
    description:
      "کد دیجیتال بازی روی اکانت شخصی خودتان فعال می‌شود؛ اکانتتان کاملاً مستقل و در اختیار خودتان باقی می‌ماند.",
  },
  {
    type: "DISC",
    label: "دیسک فیزیکی",
    subtitle: "نو · تحویل حضوری/پستی",
    description: "نسخه اصلی و فیزیکی بازی روی دیسک؛ تحویل حضوری در شعب فروشگاه یا ارسال پستی به سراسر ایران.",
  },
];

export function emptyPurchaseOptions(): PurchaseOption[] {
  return CANONICAL_OPTIONS.map((meta) => ({ ...meta, offers: [] }));
}

export function findOption(
  options: PurchaseOption[],
  type: ProductType,
  tier: AccessTier | null
): PurchaseOption | undefined {
  return options.find((o) => o.type === type && (o.tier ?? null) === tier);
}

export function lowestPriceForOption(option: PurchaseOption): number | null {
  if (option.offers.length === 0) return null;
  return Math.min(...option.offers.map((o) => o.priceToman));
}

export function bestOfferId(option: PurchaseOption): string | null {
  const inStock = option.offers.filter((o) => o.inStock);
  if (inStock.length === 0) return null;
  return inStock.reduce((best, o) => (o.priceToman < best.priceToman ? o : best)).sellerId;
}

export function lowestPrice(game: Game): number | null {
  let min: number | null = null;
  for (const option of game.purchaseOptions) {
    for (const offer of option.offers) {
      if (min === null || offer.priceToman < min) min = offer.priceToman;
    }
  }
  return min;
}

export function storeCount(game: Game): number {
  const ids = new Set<string>();
  for (const option of game.purchaseOptions) {
    for (const offer of option.offers) ids.add(offer.sellerId);
  }
  return ids.size;
}
