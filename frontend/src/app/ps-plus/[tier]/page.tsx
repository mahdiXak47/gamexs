import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "@/components/RemoteImage";
import Link from "next/link";
import Header from "@/components/Header";
import Disclaimer from "@/components/Disclaimer";
import FaqSection from "@/components/FaqSection";
import JsonLd from "@/components/JsonLd";
import {
  getPsPlusPlan,
  SLUG_TIER,
  TIER_LABEL,
  TIER_COLOR,
  TIER_SLUG,
  CAPACITY_LABEL,
  CAPACITY_DESC,
  formatPsPlusTerm,
  type PsPlusOption,
} from "@/lib/ps-plus-repo";
import { formatToman } from "@/lib/format";
import { breadcrumbJsonLd, faqPageJsonLd, psPlusFaqs, SITE_URL, tomanToRial } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return Object.keys(SLUG_TIER).map((slug) => ({ tier: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tier: string }>;
}): Promise<Metadata> {
  const { tier: slug } = await params;
  const tierKey = SLUG_TIER[slug];
  if (!tierKey) notFound();

  const plan = await getPsPlusPlan(tierKey);
  if (!plan || !plan.isActive) notFound();

  const label = TIER_LABEL[plan.tier];
  const prices = plan.options.map((o) => o.latestPrice).filter((p): p is number => p != null);
  const lowest = prices.length ? Math.min(...prices) : null;
  const title = `${label} — قیمت و مقایسه فروشندگان`;
  const description = lowest !== null
    ? `مقایسه قیمت اشتراک ${label} برای PS5 — از ${formatToman(lowest)} تومان بین فروشندگان ایرانی`
    : `مقایسه قیمت اشتراک ${label} برای PS5 بین فروشندگان ایرانی`;

  return {
    title,
    description,
    alternates: { canonical: `/ps-plus/${slug}` },
    openGraph: { title, description, url: `${SITE_URL}/ps-plus/${slug}` },
  };
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const TIER_FEATURES: Record<string, string[]> = {
  ESSENTIAL: [
    "بازی‌های رایگان ماهانه (۲ تا ۳ بازی)",
    "بازی آنلاین مالتی‌پلیر",
    "تخفیف‌های انحصاری فروشگاه",
    "فضای ذخیره‌سازی ابری ۱۰۰ گیگابایت",
    "اشتراک Spotify Premium",
  ],
  EXTRA: [
    "همه مزایای Essential",
    "کاتالوگ بازی‌های PS4 و PS5 (بیش از ۴۰۰ بازی)",
    "دسترسی به بازی‌های Day One",
    "تخفیف‌های انحصاری بیشتر",
    "فضای ذخیره‌سازی ابری ۱۰۰ گیگابایت",
  ],
  PREMIUM: [
    "همه مزایای Extra",
    "کاتالوگ کلاسیک‌های PS1، PS2، PS3 و PSP",
    "استریم ابری بازی‌ها",
    "تریل رایگان بازی‌های منتخب",
    "دسترسی زودهنگام به برخی عناوین",
    "فضای ذخیره‌سازی ابری ۱۰۰ گیگابایت",
  ],
};

function isAvailableOption(option: PsPlusOption) {
  return option.latestPrice != null && option.latestPrice > 0 && option.inStock;
}

function OptionEmptyState({ color }: { color: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center shadow-sm">
      <p className="text-base font-extrabold text-gray-900">فعلاً گزینه‌ای برای این سطح ثبت نشده است</p>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-gray-500">
        وقتی فروشنده‌ها ظرفیت‌های این اشتراک را ثبت کنند، قیمت‌ها و لینک خرید اینجا نمایش داده می‌شود.
      </p>
      <Link
        href="/ps-plus"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-bold text-white transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.98]"
        style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)` }}
      >
        مشاهده سطح‌های دیگر
      </Link>
    </div>
  );
}

function AvailabilityNotice({ hasAvailableOffer }: { hasAvailableOffer: boolean }) {
  if (hasAvailableOffer) {
    return (
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-7 text-blue-800">
        قبل از پرداخت در سایت فروشنده، قیمت نهایی و موجودی اشتراک را دوباره بررسی کنید.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
      در حال حاضر برای این سطح اشتراک، گزینه‌ای با قیمت معتبر و موجودی قابل خرید پیدا نکردیم.
    </div>
  );
}

function OptionCard({ opt, color }: { opt: PsPlusOption; color: string }) {
  const hasPrice = opt.latestPrice != null && opt.latestPrice > 0;
  const displayPrice = hasPrice ? opt.latestPrice : null;
  const available = isAvailableOption(opt);

  return (
    <div className="ui-lift-card rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Capacity header */}
      <div className="px-5 py-4 flex items-center justify-between gap-3" style={{ background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`, borderBottom: `2px solid ${color}30` }}>
        <div>
          <h3 className="font-extrabold text-gray-900 text-base">
            {CAPACITY_LABEL[opt.capacity]}
            {formatPsPlusTerm(opt.term) ? ` — ${formatPsPlusTerm(opt.term)}` : ""}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{CAPACITY_DESC[opt.capacity]}</p>
        </div>
        <div className="text-left shrink-0">
          {displayPrice !== null ? (
            <>
              <p className="text-lg font-black text-gray-900">{formatToman(displayPrice)}</p>
              <p className={`text-[11px] text-left mt-0.5 font-medium ${opt.inStock ? "text-green-600" : "text-red-400"}`}>
                {opt.inStock ? "موجود" : "ناموجود"}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-400">قیمت نامشخص</p>
          )}
        </div>
      </div>

      {/* Seller + link */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 transition-colors duration-150 hover:bg-gray-50">
        <div dir="rtl">
          <p className="text-xs text-gray-400 mb-0.5">فروشنده</p>
          <p className="text-sm font-semibold text-gray-700">{opt.sellerName}</p>
        </div>
        <a
          href={opt.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-[opacity,transform] duration-150 ${
            available
              ? "text-white hover:opacity-90 active:scale-[0.97]"
              : "bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none"
          }`}
          style={available ? { background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)` } : undefined}
          aria-disabled={!available}
          tabIndex={available ? undefined : -1}
        >
          {available ? "خرید" : "ناموجود"}
        </a>
      </div>
    </div>
  );
}

export default async function PsPlusTierPage({
  params,
}: {
  params: Promise<{ tier: string }>;
}) {
  const { tier: slug } = await params;
  const tierKey = SLUG_TIER[slug];
  if (!tierKey) notFound();

  const plan = await getPsPlusPlan(tierKey);
  if (!plan) notFound();

  const color    = TIER_COLOR[plan.tier];
  const features = TIER_FEATURES[plan.tier] ?? [];
  const availableOptions = plan.options.filter(isAvailableOption);
  const lowestPrice = availableOptions.length > 0
    ? Math.min(...availableOptions.map((o) => o.latestPrice!))
    : null;
  const faqs = psPlusFaqs(TIER_LABEL[plan.tier]);
  const breadcrumbSchema = breadcrumbJsonLd([
    { name: "بازی‌های PS5", path: "/" },
    { name: "PS Plus", path: "/ps-plus" },
    { name: TIER_LABEL[plan.tier], path: `/ps-plus/${slug}` },
  ]);

  // Other tiers for cross-links
  const otherTiers = (["ESSENTIAL", "EXTRA", "PREMIUM"] as const).filter((t) => t !== plan.tier);

  // See the games/[slug] page for why 0-priced listings are excluded — same
  // scraper artifact on out-of-stock offers.
  const offers = plan.options
    .filter((o) => o.latestPrice != null && o.latestPrice > 0)
    .map((o) => ({
      "@type": "Offer",
      name: `${CAPACITY_LABEL[o.capacity]}${formatPsPlusTerm(o.term) ? ` — ${formatPsPlusTerm(o.term)}` : ""}`,
      url: o.sourceUrl,
      priceCurrency: "IRR",
      price: tomanToRial(o.latestPrice!),
      availability: o.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: o.sellerName },
    }));

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: TIER_LABEL[plan.tier],
    description: `اشتراک ${TIER_LABEL[plan.tier]} برای PS5`,
    image: plan.coverUrl ?? undefined,
    ...(offers.length > 0 && {
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "IRR",
        lowPrice: Math.min(...offers.map((o) => o.price)),
        offerCount: offers.length,
        offers,
      },
    }),
  };

  return (
    <>
      <JsonLd data={productJsonLd} />
      <JsonLd data={faqPageJsonLd(faqs)} />
      <JsonLd data={breadcrumbSchema} />
      <Header />

      {/* Hero */}
      <div className="ps-header">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <Link
            href="/ps-plus"
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-5 transition-colors"
            dir="rtl"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 18 6-6-6-6" />
            </svg>
            همه اشتراک‌ها
          </Link>

          <div className="flex items-center gap-5" dir="rtl">
            {plan.coverUrl ? (
              <div className="relative w-20 h-[106px] rounded-xl overflow-hidden ring-2 ring-white/20 shrink-0">
                <Image src={plan.coverUrl} alt={TIER_LABEL[plan.tier]} fill className="object-cover" sizes="80px" />
              </div>
            ) : (
              <div className="w-20 h-[106px] rounded-xl bg-white/10 shrink-0 flex items-center justify-center text-white/30 font-black text-2xl">
                P
              </div>
            )}
            <div>
              <h1 className="text-3xl font-black text-white">{TIER_LABEL[plan.tier]}</h1>
              {lowestPrice !== null ? (
                <p className="text-white/70 text-sm mt-1">از {formatToman(lowestPrice)}</p>
              ) : (
                <p className="text-white/70 text-sm mt-1">بدون موجودی قابل خرید</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-10">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT: pricing options */}
          <div className="lg:col-span-2 space-y-4" dir="rtl">
            <h2 className="text-lg font-extrabold text-gray-900">انتخاب ظرفیت</h2>
            <AvailabilityNotice hasAvailableOffer={availableOptions.length > 0} />
            {plan.options.length > 0 ? (
              plan.options.map((opt) => (
                <OptionCard key={opt.id} opt={opt} color={color} />
              ))
            ) : (
              <OptionEmptyState color={color} />
            )}
          </div>

          {/* RIGHT: features */}
          <aside className="space-y-4" dir="rtl">
            <div className="ui-lift-card rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-extrabold text-gray-900 mb-4">امکانات این سطح</h2>
              <ul className="space-y-2.5">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckIcon className="shrink-0 text-green-500 mt-0.5" />
                    <span className="text-sm text-gray-700">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Other tiers */}
            <div className="ui-lift-card rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-extrabold text-gray-900 mb-3">سایر سطح‌ها</h2>
              <div className="space-y-2">
                {otherTiers.map((t) => (
                  <Link
                    key={t}
                    href={`/ps-plus/${TIER_SLUG[t]}`}
                    className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 transition-[background-color,color,transform] duration-150 hover:-translate-x-0.5 hover:bg-gray-100 hover:text-gray-900"
                  >
                    <span>{TIER_LABEL[t]}</span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <FaqSection title={`سؤال‌های متداول ${TIER_LABEL[plan.tier]}`} faqs={faqs} />

      </main>

      <Disclaimer />
    </>
  );
}
