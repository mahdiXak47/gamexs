export const SITE_URL = "https://gamexs.ir";
export const SITE_NAME = "GameXS";
export const SITE_LOGO_URL = `${SITE_URL}/logos/logo7.png`;

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
  return query.trim().length > 0 || sort !== "popular" || publishers.length > 0 || page > 1;
}
