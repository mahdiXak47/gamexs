import type { Game, PurchaseOption } from "./types";

// Mock catalog for the frontend design pass — no database/scraper feed wired
// up yet (see repo TODO.md). Shape mirrors the scraper's product taxonomy
// (ProductType / AccessTier) so swapping this for real data later is a
// straight data-source change, not a UI rewrite.

function capacity1(offers: PurchaseOption["offers"]): PurchaseOption {
  return {
    type: "ACCOUNT_GAME",
    tier: "CAPACITY_1",
    label: "اکانت ظرفیت ۱",
    subtitle: "اختصاصی · فقط آفلاین",
    description:
      "اکانت اختصاصی؛ کل اکانت به شما تحویل داده می‌شود. برای اینکه اکانت از دسترس شما خارج نشود باید همیشه آفلاین بازی کنید.",
    offers,
  };
}

function capacity2(offers: PurchaseOption["offers"]): PurchaseOption {
  return {
    type: "ACCOUNT_GAME",
    tier: "CAPACITY_2",
    label: "اکانت ظرفیت ۲",
    subtitle: "اشتراکی · آنلاین و آفلاین",
    description:
      "اکانت اشتراکی؛ می‌توانید هم آنلاین و هم آفلاین بازی کنید. منعطف‌تر و معمولاً گران‌تر از ظرفیت ۳.",
    offers,
  };
}

function capacity3(offers: PurchaseOption["offers"]): PurchaseOption {
  return {
    type: "ACCOUNT_GAME",
    tier: "CAPACITY_3",
    label: "اکانت ظرفیت ۳",
    subtitle: "اشتراکی · فقط آنلاین",
    description:
      "اکانت اشتراکی و ارزان‌تر؛ اما کنسول شما باید همیشه به اینترنت متصل بماند تا بازی اجرا شود.",
    offers,
  };
}

function ownAccount(offers: PurchaseOption["offers"]): PurchaseOption {
  return {
    type: "OWN_ACCOUNT_GAME",
    label: "روی اکانت شما",
    subtitle: "کد دیجیتال",
    description:
      "کد دیجیتال بازی روی اکانت شخصی خودتان فعال می‌شود؛ اکانتتان کاملاً مستقل و در اختیار خودتان باقی می‌ماند.",
    offers,
  };
}

function disc(offers: PurchaseOption["offers"]): PurchaseOption {
  return {
    type: "DISC",
    label: "دیسک فیزیکی",
    subtitle: "نو · تحویل حضوری/پستی",
    description: "نسخه اصلی و فیزیکی بازی روی دیسک؛ تحویل حضوری در شعب فروشگاه یا ارسال پستی به سراسر ایران.",
    offers,
  };
}

export const GAMES: Game[] = [
  {
    slug: "saros",
    title: "Saros",
    genreLabel: "اکشن، بقا",
    publisher: "Housemarque",
    releaseYear: 2025,
    coverInitial: "S",
    purchaseOptions: [
      capacity1([]),
      capacity2([
        { sellerId: "parsconsole", priceToman: 7420000, inStock: true },
        { sellerId: "pspro", priceToman: 7500000, inStock: true },
        { sellerId: "gamario", priceToman: 7570000, inStock: true },
        { sellerId: "yungcenter", priceToman: 7870000, inStock: true },
        { sellerId: "xgamesstore", priceToman: 7120000, inStock: false },
      ]),
      capacity3([
        { sellerId: "xgamesstore", priceToman: 4560000, inStock: true },
        { sellerId: "pspro", priceToman: 4650000, inStock: true },
        { sellerId: "parsconsole", priceToman: 4700000, inStock: true },
        { sellerId: "gamario", priceToman: 4790000, inStock: true },
        { sellerId: "gamecenter", priceToman: 4850000, inStock: true },
        { sellerId: "yungcenter", priceToman: 4990000, inStock: false },
      ]),
      ownAccount([]),
      disc([]),
    ],
  },
  {
    slug: "god-of-war-ragnarok",
    title: "God of War Ragnarök",
    genreLabel: "اکشن ماجراجویی",
    publisher: "Santa Monica Studio",
    releaseYear: 2022,
    coverInitial: "GO",
    purchaseOptions: [
      capacity2([
        { sellerId: "pspro", priceToman: 3450000, inStock: true },
        { sellerId: "parsconsole", priceToman: 3510000, inStock: true },
        { sellerId: "gamario", priceToman: 3600000, inStock: true },
        { sellerId: "yungcenter", priceToman: 3690000, inStock: false },
      ]),
      capacity3([
        { sellerId: "xgamesstore", priceToman: 2760000, inStock: true },
        { sellerId: "pspro", priceToman: 2810000, inStock: true },
        { sellerId: "gamecenter", priceToman: 2890000, inStock: true },
      ]),
      ownAccount([
        { sellerId: "gameonestore", priceToman: 3990000, inStock: true },
        { sellerId: "cdkeyshare", priceToman: 4050000, inStock: false },
      ]),
      disc([
        { sellerId: "digikala", priceToman: 2990000, inStock: true },
        { sellerId: "nakhlmarket", priceToman: 3050000, inStock: true },
        { sellerId: "persianconsole", priceToman: 3120000, inStock: true },
      ]),
    ],
  },
  {
    slug: "marvels-spider-man-2",
    title: "Marvel's Spider-Man 2",
    genreLabel: "اکشن ماجراجویی",
    publisher: "Insomniac Games",
    releaseYear: 2023,
    coverInitial: "MS",
    purchaseOptions: [
      capacity1([{ sellerId: "pspro", priceToman: 4450000, inStock: true }]),
      capacity2([
        { sellerId: "parsconsole", priceToman: 3990000, inStock: true },
        { sellerId: "gamario", priceToman: 4090000, inStock: true },
        { sellerId: "yungcenter", priceToman: 4190000, inStock: true },
      ]),
      capacity3([
        { sellerId: "pspro", priceToman: 3230000, inStock: true },
        { sellerId: "xgamesstore", priceToman: 3290000, inStock: true },
        { sellerId: "gamecenter", priceToman: 3350000, inStock: true },
        { sellerId: "nakhlmarket", priceToman: 3410000, inStock: true },
      ]),
      disc([
        { sellerId: "digikala", priceToman: 3690000, inStock: true },
        { sellerId: "persianconsole", priceToman: 3750000, inStock: true },
      ]),
    ],
  },
  {
    slug: "ea-sports-fc-25",
    title: "EA Sports FC 25",
    genreLabel: "ورزشی",
    publisher: "EA Sports",
    releaseYear: 2024,
    coverInitial: "ES",
    purchaseOptions: [
      capacity2([
        { sellerId: "pspro", priceToman: 3100000, inStock: true },
        { sellerId: "gamario", priceToman: 3180000, inStock: true },
      ]),
      capacity3([
        { sellerId: "xgamesstore", priceToman: 2470000, inStock: true },
        { sellerId: "parsconsole", priceToman: 2520000, inStock: true },
        { sellerId: "gamecenter", priceToman: 2590000, inStock: true },
      ]),
      disc([
        { sellerId: "digikala", priceToman: 2690000, inStock: true },
        { sellerId: "nakhlmarket", priceToman: 2750000, inStock: true },
        { sellerId: "yungcenter", priceToman: 2810000, inStock: false },
      ]),
    ],
  },
  {
    slug: "elden-ring",
    title: "Elden Ring",
    genreLabel: "نقش‌آفرینی اکشن",
    publisher: "FromSoftware",
    releaseYear: 2022,
    coverInitial: "ER",
    purchaseOptions: [
      capacity1([{ sellerId: "pspro", priceToman: 3450000, inStock: true }]),
      capacity2([
        { sellerId: "parsconsole", priceToman: 2980000, inStock: true },
        { sellerId: "gamario", priceToman: 3040000, inStock: true },
      ]),
      capacity3([
        { sellerId: "xgamesstore", priceToman: 2380000, inStock: true },
        { sellerId: "pspro", priceToman: 2430000, inStock: true },
        { sellerId: "gamecenter", priceToman: 2490000, inStock: true },
      ]),
      disc([
        { sellerId: "digikala", priceToman: 2590000, inStock: true },
        { sellerId: "cdkeyshare", priceToman: 2650000, inStock: true },
      ]),
    ],
  },
  {
    slug: "hogwarts-legacy",
    title: "Hogwarts Legacy",
    genreLabel: "نقش‌آفرینی",
    publisher: "Avalanche Software",
    releaseYear: 2023,
    coverInitial: "HL",
    purchaseOptions: [
      capacity2([
        { sellerId: "pspro", priceToman: 2830000, inStock: true },
        { sellerId: "yungcenter", priceToman: 2900000, inStock: true },
      ]),
      capacity3([
        { sellerId: "gamecenter", priceToman: 2280000, inStock: true },
        { sellerId: "xgamesstore", priceToman: 2330000, inStock: true },
        { sellerId: "parsconsole", priceToman: 2390000, inStock: false },
      ]),
      disc([
        { sellerId: "digikala", priceToman: 2470000, inStock: true },
        { sellerId: "nakhlmarket", priceToman: 2520000, inStock: true },
      ]),
    ],
  },
  {
    slug: "the-last-of-us-part-i",
    title: "The Last of Us Part I",
    genreLabel: "اکشن ماجراجویی",
    publisher: "Naughty Dog",
    releaseYear: 2022,
    coverInitial: "TL",
    purchaseOptions: [
      capacity1([{ sellerId: "pspro", priceToman: 3550000, inStock: true }]),
      capacity2([
        { sellerId: "parsconsole", priceToman: 3210000, inStock: true },
        { sellerId: "gamario", priceToman: 3280000, inStock: true },
      ]),
      capacity3([
        { sellerId: "xgamesstore", priceToman: 2660000, inStock: true },
        { sellerId: "pspro", priceToman: 2710000, inStock: true },
        { sellerId: "gamecenter", priceToman: 2770000, inStock: true },
      ]),
      disc([
        { sellerId: "digikala", priceToman: 2870000, inStock: true },
        { sellerId: "persianconsole", priceToman: 2930000, inStock: true },
      ]),
    ],
  },
  {
    slug: "ghost-of-tsushima",
    title: "Ghost of Tsushima",
    genreLabel: "اکشن ماجراجویی",
    publisher: "Sucker Punch Productions",
    releaseYear: 2020,
    coverInitial: "GO",
    purchaseOptions: [
      capacity2([
        { sellerId: "pspro", priceToman: 2650000, inStock: true },
        { sellerId: "yungcenter", priceToman: 2720000, inStock: true },
      ]),
      capacity3([
        { sellerId: "xgamesstore", priceToman: 2190000, inStock: true },
        { sellerId: "gamecenter", priceToman: 2240000, inStock: true },
        { sellerId: "gamario", priceToman: 2300000, inStock: true },
      ]),
      disc([
        { sellerId: "digikala", priceToman: 2380000, inStock: true },
        { sellerId: "nakhlmarket", priceToman: 2440000, inStock: false },
      ]),
    ],
  },
];

export function getGame(slug: string): Game | undefined {
  return GAMES.find((g) => g.slug === slug);
}

export function purchaseTypeCount(game: Game): number {
  return game.purchaseOptions.filter((o) => o.offers.length > 0).length;
}

export function storeCount(game: Game): number {
  const ids = new Set<string>();
  for (const option of game.purchaseOptions) {
    for (const offer of option.offers) ids.add(offer.sellerId);
  }
  return ids.size;
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

export function lowestPriceForOption(option: PurchaseOption): number | null {
  if (option.offers.length === 0) return null;
  return Math.min(...option.offers.map((o) => o.priceToman));
}

export function bestOfferId(option: PurchaseOption): string | null {
  const inStock = option.offers.filter((o) => o.inStock);
  if (inStock.length === 0) return null;
  return inStock.reduce((best, o) => (o.priceToman < best.priceToman ? o : best)).sellerId;
}
