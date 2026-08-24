export const SITE_URL = "https://gamexs.ir";
export const SITE_NAME = "GameXS";
export const SITE_LOGO_URL = `${SITE_URL}/logos/logo2.png`;
export const SITE_PREVIEW_IMAGE = {
  url: SITE_LOGO_URL,
  width: 971,
  height: 347,
  alt: "GameXS — مقایسه قیمت بازی‌های PS5",
};

export function gameOgImageUrl(slug: string): string {
  return `${SITE_URL}/games/${encodeURIComponent(slug)}/opengraph-image`;
}

export interface SeoFaq {
  question: string;
  answer: string;
}

export interface SeoBreadcrumbItem {
  name: string;
  path: string;
}

// Structured data requires an ISO 4217 currency code — Toman (the unit shown
// throughout the UI) isn't one, so schema.org prices are expressed in Rial
// (Toman × 10), the actual ISO currency. This only affects the invisible
// JSON-LD payload, never anything rendered on the page.
export function tomanToRial(toman: number): number {
  return toman * 10;
}

export function faqPageJsonLd(faqs: SeoFaq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function breadcrumbJsonLd(items: SeoBreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function gamePurchaseFaqs(gameTitle: string): SeoFaq[] {
  return [
    {
      question: `بهترین قیمت ${gameTitle} برای PS5 چطور پیدا می‌شود؟`,
      answer:
        `GameXS قیمت‌های ثبت‌شده از فروشندگان ایرانی را کنار هم نشان می‌دهد تا کمترین قیمت ${gameTitle}، نوع خرید و وضعیت موجودی را قبل از رفتن به سایت فروشنده مقایسه کنید.`,
    },
    {
      question: "تفاوت ظرفیت ۱، ظرفیت ۲ و ظرفیت ۳ اکانت PS5 چیست؟",
      answer:
        "ظرفیت ۱ معمولاً برای استفاده آفلاین، ظرفیت ۲ برای استفاده آنلاین و آفلاین، و ظرفیت ۳ برای استفاده آنلاین روی اکانت اشتراکی است. محدودیت دقیق هر فروشنده باید قبل از خرید در سایت همان فروشنده بررسی شود.",
    },
    {
      question: "خرید از GameXS انجام می‌شود؟",
      answer:
        "خیر. GameXS فروشگاه نیست و پرداخت یا تحویل کالا انجام نمی‌دهد. هر ردیف قیمت به صفحه همان فروشنده لینک می‌شود و خرید نهایی در سایت فروشنده انجام می‌شود.",
    },
    {
      question: "قیمت‌های بازی‌های PS5 چند وقت یک‌بار به‌روزرسانی می‌شوند؟",
      answer:
        "قیمت‌ها به‌صورت دوره‌ای از فروشندگان جمع‌آوری می‌شوند. زمان آخرین به‌روزرسانی در صفحه فهرست بازی‌ها نمایش داده می‌شود.",
    },
  ];
}

export function psPlusFaqs(label: string): SeoFaq[] {
  return [
    {
      question: `${label} چیست؟`,
      answer:
        `${label} یکی از سطح‌های اشتراک PlayStation Plus است. امکانات دقیق هر سطح با سطح‌های دیگر فرق دارد و در همین صفحه کنار قیمت فروشندگان ایرانی نمایش داده می‌شود.`,
    },
    {
      question: "ظرفیت‌های اشتراک PS Plus چه تفاوتی دارند؟",
      answer:
        "ظرفیت‌ها مشخص می‌کنند اشتراک روی چه نوع اکانتی و با چه محدودیت استفاده‌ای ارائه می‌شود. ظرفیت ۲ معمولاً انعطاف بیشتری دارد و ظرفیت ۳ معمولاً ارزان‌تر اما محدودتر است.",
    },
    {
      question: "آیا خرید اشتراک از GameXS انجام می‌شود؟",
      answer:
        "خیر. GameXS فقط قیمت‌ها را مقایسه می‌کند. برای خرید، از لینک فروشنده استفاده می‌کنید و پرداخت در سایت همان فروشنده انجام می‌شود.",
    },
    {
      question: "قبل از خرید PS Plus باید چه چیزی را بررسی کنم؟",
      answer:
        "ظرفیت، ریجن، مدت اشتراک، وضعیت موجودی و شرایط تحویل فروشنده را بررسی کنید. GameXS قیمت و فروشنده را نمایش می‌دهد اما مسئول شرایط فروش فروشنده نیست.",
    },
  ];
}

export function taxonomyFaqs(): SeoFaq[] {
  return [
    {
      question: "تفاوت ظرفیت ۱، ظرفیت ۲ و ظرفیت ۳ بازی PS5 چیست؟",
      answer:
        "ظرفیت ۱ معمولاً برای استفاده آفلاین، ظرفیت ۲ برای استفاده آنلاین و آفلاین، و ظرفیت ۳ برای استفاده آنلاین روی اکانت اشتراکی ارائه می‌شود. شرایط دقیق هر پیشنهاد را قبل از خرید در سایت فروشنده بررسی کنید.",
    },
    {
      question: "خرید دیسک بازی PS5 چه تفاوتی با اکانت بازی دارد؟",
      answer:
        "دیسک یک نسخه فیزیکی است که روی کنسول استفاده می‌شود؛ اکانت بازی دیجیتال است و محدودیت‌های ظرفیت، ورود و استفاده آن به شرایط فروشنده بستگی دارد.",
    },
    {
      question: "خرید بازی برای اکانت خودم یعنی چه؟",
      answer:
        "در این نوع پیشنهاد، فروشنده ادعا می‌کند بازی روی اکانت شخصی خریدار فعال می‌شود. قبل از پرداخت، ریجن، روش فعال‌سازی و شرایط پشتیبانی فروشنده را بررسی کنید.",
    },
    {
      question: "PS Plus چه نوع اشتراکی است؟",
      answer:
        "PS Plus یک اشتراک خدمات PlayStation است که در سطح‌های Essential، Extra و Premium عرضه می‌شود. مدت، ریجن و ظرفیت اشتراک را با توضیحات فروشنده تطبیق دهید.",
    },
    {
      question: "آیا خرید از GameXS انجام می‌شود؟",
      answer:
        "خیر. GameXS فروشگاه نیست و پرداخت یا تحویل کالا انجام نمی‌دهد. این سایت قیمت‌ها را مقایسه می‌کند و خرید نهایی از سایت فروشنده انجام می‌شود.",
    },
  ];
}

export function shouldNoIndexCatalogParams({
  query,
  sort,
  publishers,
  page,
}: {
  query: string;
  sort: string;
  publishers: string[];
  page: number;
}): boolean {
  // Plain pagination is a useful, crawlable continuation of a catalog. Search,
  // sort, and filtered variants remain noindex because they create near-duplicate
  // URL combinations. Page 2+ gets its own canonical in each catalog route.
  void page;
  return query.trim().length > 0 || sort !== "popular" || publishers.length > 0;
}

export function catalogCanonicalPath(
  basePath: string,
  { page, query, sort, publishers }: { page: number; query: string; sort: string; publishers: string[] }
): string {
  if (page <= 1 || query.trim() || sort !== "popular" || publishers.length > 0) return basePath;
  return `${basePath}${basePath.includes("?") ? "&" : "?"}page=${page}`;
}
