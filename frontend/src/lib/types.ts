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
  priceToman: number;
  inStock: boolean;
}

export interface PurchaseOption {
  type: ProductType;
  tier?: AccessTier;
  label: string;
  subtitle: string;
  description: string;
  offers: SellerOffer[];
}

export interface Game {
  slug: string;
  title: string;
  genreLabel: string;
  publisher: string;
  releaseYear: number;
  coverInitial: string;
  purchaseOptions: PurchaseOption[];
}
