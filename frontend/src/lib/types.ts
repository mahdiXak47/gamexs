export type ProductType = "ACCOUNT_GAME" | "OWN_ACCOUNT_GAME" | "DISC";
export type AccessTier = "CAPACITY_1" | "CAPACITY_2" | "CAPACITY_3";

export interface Seller {
  id: string;
  name: string;
  domain: string;
  initial: string;
}

export interface SellerOffer {
  sellerId: string;
  sellerName: string;
  sellerDomain: string;
  priceToman: number;
  inStock: boolean;
  listingUrl: string;
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
  slug: string;
  title: string;
  genreLabel: string | null;
  publisher: string | null;
  releaseYear: number | null;
  coverInitial: string;
  coverUrl: string | null;
  keyArtUrl: string | null;
  screenshots: string[];
  purchaseOptions: PurchaseOption[];
  details: GameDetails | null;
}

// Lighter shape for the grid — stats are precomputed in SQL rather than
// derived client-side from a full purchaseOptions array.
export interface GameSummary {
  slug: string;
  title: string;
  genreLabel: string | null;
  publisher: string | null;
  coverInitial: string;
  coverUrl: string | null;
  lowestPriceToman: number | null;
  storeCount: number;
  purchaseTypeCount: number;
  createdAt: number;
}
