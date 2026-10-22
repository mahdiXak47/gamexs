export type ProductType = "ACCOUNT_GAME" | "OWN_ACCOUNT_GAME" | "DISC";
export type AccessTier = "CAPACITY_1" | "CAPACITY_2" | "CAPACITY_3";
export type SortOption = "popular" | "newest" | "price_asc" | "price_desc" | "alpha_asc" | "alpha_desc";

export interface Seller {
  id: string;
  name: string;
  domain: string;
  initial: string;
}

/** sellers.installment_options (migration 038, scraper/detect_installments.py). */
export type InstallmentOption = "own" | "digipay" | "snapppay" | "torobpay";

export interface SellerOffer {
  sellerId: string;
  sellerName: string;
  sellerDomain: string;
  priceToman: number;
  inStock: boolean;
  listingUrl: string;
  /** listings.id — buy links go through /go/[listingId] so clicks are counted. */
  listingId: string;
  installments: InstallmentOption[];
}

export interface PurchaseOption {
  type: ProductType;
  tier?: AccessTier;
  label: string;
  subtitle: string;
  description: string;
  offers: SellerOffer[];
}

export interface GameDetails {
  developers: string[];
  genres: string[];
  themes: string[];
  gameModes: string[];
  playerPerspectives: string[];
  series: string[];
  franchises: string[];
  gameEngines: string[];
  summary: string;
  keywords: string[];
}

export interface Game {
  dbId: number;
  slug: string;
  title: string;
  genreLabel: string | null;
  genres: string[]; // full IGDB genre list — genreLabel is only the primary one
  developers: string[];
  publisher: string | null;
  releaseYear: number | null;
  releaseDate: string | null; // ISO date string "YYYY-MM-DD"
  lastModifiedAt: string | null; // latest relevant listing price observation
  coverInitial: string;
  coverUrl: string | null;
  mainBackgroundImageUrl: string | null;
  description: string | null;
  /** Structured editorial overview (ps5_games.overview, migration 040). */
  overview: GameOverview | null;
  screenshots: string[];
  /** Self-hosted 720p trailer (scraper/fetch_trailers.py); detail page only. */
  trailer?: { url: string; updatedAt: string | null } | null;
  purchaseOptions: PurchaseOption[];
  details: GameDetails | null;
}

export interface GamePriceHistoryPoint {
  day: string;
  productType: ProductType;
  tier: AccessTier | null;
  priceToman: number;
}

export interface UpcomingGame {
  slug: string;
  title: string;
  genreLabel: string | null;
  coverUrl: string | null;
  mainBackgroundImageUrl: string | null;
  releaseDate: string; // ISO date string "YYYY-MM-DD", always present
  lowestPriceToman: number | null;
  capacity2PriceToman: number | null;
  sellerCount: number;
}

export interface HeroPriceOption {
  key: "capacity_1" | "capacity_2" | "capacity_3" | "full_capacity" | "disc";
  label: string;
  priceToman: number | null;
}

// Lighter shape for the grid — stats are precomputed in SQL rather than
// derived client-side from a full purchaseOptions array.
export interface GameSummary {
  dbId?: number;
  slug: string;
  title: string;
  genreLabel: string | null;
  releaseYear?: number | null;
  publisher: string | null;
  coverInitial: string;
  coverUrl: string | null;
  mainBackgroundImageUrl: string | null;
  screenshotUrl: string | null;
  lowestPriceToman: number | null;
  lowestPriceLabel: string | null;
  heroPriceOptions: HeroPriceOption[];
  storeCount: number;
  purchaseTypeCount: number;
  createdAt: number;
  /** Latest active listing observation, used for sitemap lastmod only. */
  lastSeenAt?: number;
}

/**
 * GameXS-written Persian overview for the «توضیحات» tab. `media` references the
 * game's own assets by key: "trailer" or "screenshot:N" (1-based position in
 * Game.screenshots); keys with no matching asset are skipped when rendering.
 */
export interface GameOverview {
  intro: string;
  suits?: string[];
  sections: { heading: string; paragraphs: string[]; media?: string }[];
}
