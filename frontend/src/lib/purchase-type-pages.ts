import type { AccessTier, ProductType } from "./types";

export interface PurchaseTypePageDefinition {
  slug: string;
  path: string;
  title: string;
  h1: string;
  description: string;
  productType: ProductType;
  tier?: AccessTier;
}

export const PURCHASE_TYPE_PAGES: PurchaseTypePageDefinition[] = [
  {
    slug: "account-games",
    path: "/account-games",
    title: "خرید اکانت بازی PS5 — قیمت و مقایسه فروشندگان",
    h1: "اکانت بازی PS5",
    description: "مقایسه قیمت اکانت بازی‌های PS5 در ظرفیت‌های مختلف بین فروشندگان ایرانی.",
    productType: "ACCOUNT_GAME",
  },
  {
    slug: "capacity-1",
    path: "/capacity-1",
    title: "اکانت ظرفیت ۱ PS5 — قیمت و مقایسه",
    h1: "اکانت ظرفیت ۱ PS5",
    description: "فهرست بازی‌های PS5 با اکانت ظرفیت ۱ و مقایسه قیمت فروشندگان ایرانی.",
    productType: "ACCOUNT_GAME",
    tier: "CAPACITY_1",
  },
  {
    slug: "capacity-2",
    path: "/capacity-2",
    title: "اکانت ظرفیت ۲ PS5 — قیمت و مقایسه",
    h1: "اکانت ظرفیت ۲ PS5",
    description: "فهرست بازی‌های PS5 با اکانت ظرفیت ۲ برای مقایسه قیمت و موجودی.",
    productType: "ACCOUNT_GAME",
    tier: "CAPACITY_2",
  },
  {
    slug: "capacity-3",
    path: "/capacity-3",
    title: "اکانت ظرفیت ۳ PS5 — قیمت و مقایسه",
    h1: "اکانت ظرفیت ۳ PS5",
    description: "فهرست بازی‌های PS5 با اکانت ظرفیت ۳ و قیمت‌های ارزان‌تر فروشندگان ایرانی.",
    productType: "ACCOUNT_GAME",
    tier: "CAPACITY_3",
  },
  {
    slug: "disc-games",
    path: "/disc-games",
    title: "خرید دیسک بازی PS5 — قیمت و مقایسه",
    h1: "دیسک بازی PS5",
    description: "مقایسه قیمت نسخه فیزیکی و دیسک بازی‌های PS5 بین فروشندگان ایرانی.",
    productType: "DISC",
  },
  {
    slug: "own-account-games",
    path: "/own-account-games",
    title: "خرید بازی PS5 برای اکانت خودتان — قیمت و مقایسه",
    h1: "خرید بازی PS5 برای اکانت خودتان",
    description: "فهرست پیشنهادهای فعال‌سازی بازی PS5 روی اکانت شخصی و مقایسه قیمت فروشندگان.",
    productType: "OWN_ACCOUNT_GAME",
  },
];

export function purchaseTypePageBySlug(slug: string): PurchaseTypePageDefinition | null {
  return PURCHASE_TYPE_PAGES.find((page) => page.slug === slug) ?? null;
}
