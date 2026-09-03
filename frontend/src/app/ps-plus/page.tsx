import Image from "@/components/RemoteImage";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import Header from "@/components/Header";
import Disclaimer from "@/components/Disclaimer";
import JsonLd from "@/components/JsonLd";
import {
  getAllPsPlusPlans,
  TIER_LABEL,
  TIER_COLOR,
  TIER_SLUG,
  CAPACITY_LABEL,
  CAPACITY_DESC,
  formatPsPlusTerm,
  type PsPlusPlan,
} from "@/lib/ps-plus-repo";
import { formatToman } from "@/lib/format";
import { breadcrumbJsonLd, SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "PS Plus",
  description: "مقایسه قیمت اشتراک PS Plus در فروشندگان ایرانی: Essential، Extra و Premium",
  alternates: { canonical: "/ps-plus" },
};

function TierBadge({ badge }: { badge: string | null }) {
  if (!badge) return <div className="h-[22px] mb-2" />;
  return (
    <div className="h-[22px] mb-2 flex items-center">
      <span className="inline-block text-[11px] font-bold bg-yellow-400 text-black px-2.5 py-0.5 rounded-full">
        {badge}
      </span>
    </div>
  );
}

const TIER_BADGE: Record<string, string | null> = {
  ESSENTIAL: null,
  EXTRA:     "محبوب‌ترین",
  PREMIUM:   "کامل‌ترین",
};

function isAvailableOption(option: PsPlusPlan["options"][number]) {
  return option.latestPrice != null && option.latestPrice > 0 && option.inStock;
}

function getLowestAvailablePrice(plan: PsPlusPlan) {
  const prices = plan.options
    .filter(isAvailableOption)
    .map((option) => option.latestPrice!);

  return prices.length > 0 ? Math.min(...prices) : null;
}

function EmptyPsPlusState() {
  return (
    <section dir="rtl" className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center shadow-sm">
      <p className="text-base font-extrabold text-gray-900">فعلاً قیمت قابل مقایسه‌ای برای PS Plus نداریم</p>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-gray-500">
        وقتی قیمت تازه از فروشنده‌ها ثبت شود، همین‌جا سطح‌های Essential، Extra و Premium را می‌بینید.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-ps-blue px-5 text-sm font-bold text-white transition-[background-color,transform] duration-150 hover:bg-blue-700 active:scale-[0.98]"
      >
        مشاهده قیمت بازی‌ها
      </Link>
    </section>
  );
}

function PlanCard({ plan }: { plan: PsPlusPlan }) {
  const color = TIER_COLOR[plan.tier];
  const slug  = TIER_SLUG[plan.tier];
  const lowestPrice = getLowestAvailablePrice(plan);
  const hasAvailableOffer = lowestPrice !== null;

  return (
    <div className="ui-lift-card relative rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Colored header */}
      <div className="px-6 py-5 text-white" style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)` }}>
        <TierBadge badge={TIER_BADGE[plan.tier]} />

        {/* Cover + title side by side */}
        <div className="flex items-center gap-4">
          {plan.coverUrl ? (
            <div className="relative w-14 h-[74px] rounded-lg overflow-hidden ring-1 ring-white/20 shrink-0">
              <Image src={plan.coverUrl} alt={TIER_LABEL[plan.tier]} fill className="object-cover" sizes="56px" />
            </div>
          ) : (
            <div className="w-14 h-[74px] rounded-lg bg-white/10 shrink-0 flex items-center justify-center text-white/30 font-black text-lg">
              {plan.tier[0]}
            </div>
          )}
          <div>
            <h2 className="text-xl font-black">{TIER_LABEL[plan.tier]}</h2>
            {lowestPrice !== null ? (
              <p className="text-white/70 text-xs mt-0.5">
                از {formatToman(lowestPrice)}
              </p>
            ) : (
              <p className="text-white/70 text-xs mt-0.5">بدون موجودی قابل خرید</p>
            )}
          </div>
        </div>
      </div>

      {/* Capacity rows */}
      <div className="px-6 py-4 flex-1 divide-y divide-gray-100" dir="rtl">
        {plan.options.map((opt) => (
          <div key={opt.id} className="flex items-center justify-between gap-3 py-3 transition-colors duration-150 hover:bg-gray-50">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {CAPACITY_LABEL[opt.capacity]}
                {formatPsPlusTerm(opt.term) ? ` — ${formatPsPlusTerm(opt.term)}` : ""}
              </p>
              <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{CAPACITY_DESC[opt.capacity]}</p>
            </div>
            <div className="text-left shrink-0">
              {opt.latestPrice != null && opt.latestPrice > 0 ? (
                <>
                  <p className="text-sm font-bold text-gray-900">{formatToman(opt.latestPrice)}</p>
                  <p className={`text-[11px] mt-0.5 ${opt.inStock ? "text-green-600" : "text-red-400"}`}>
                    {opt.inStock ? "موجود" : "ناموجود"}
                  </p>
                </>
              ) : (
                <p className="text-xs text-gray-400">قیمت نامشخص</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="px-6 pb-5 pt-1">
        <Link
          href={`/ps-plus/${slug}`}
          className="block w-full rounded-xl py-2.5 text-center text-sm font-semibold text-white transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.98]"
          style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)` }}
        >
          {hasAvailableOffer ? "مشاهده جزئیات" : "بررسی وضعیت"}
        </Link>
      </div>
    </div>
  );
}

export default async function PsPlusPage() {
  const plans = await getAllPsPlusPlans();
  const hasAvailablePlans = plans.some((plan) => getLowestAvailablePrice(plan) !== null);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: plans.map((plan, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/ps-plus/${TIER_SLUG[plan.tier]}`,
      name: TIER_LABEL[plan.tier],
    })),
  };
  const breadcrumbItems = [
    { label: "بازی‌های PS5", href: "/" },
    { label: "PS Plus" },
  ];
  const breadcrumbSchema = breadcrumbJsonLd([
    { name: "بازی‌های PS5", path: "/" },
    { name: "PS Plus", path: "/ps-plus" },
  ]);

  return (
    <>
      {plans.length > 0 && <JsonLd data={itemListJsonLd} />}
      <JsonLd data={breadcrumbSchema} />
      <Header />

      <div className="ps-header">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 text-center">
          <div className="mb-5 flex justify-center">
            <Breadcrumb items={breadcrumbItems} light />
          </div>
          <h1 className="text-3xl font-black text-white">
            PS <span className="text-yellow-400">Plus</span>
          </h1>
          <p className="mt-2 text-white/70 text-sm max-w-xl mx-auto">
            مقایسه قیمت اشتراک PS Plus از فروشندگان معتبر ایران: Essential، Extra و Premium
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-12">

        {/* Tier cards */}
        {plans.length > 0 ? (
          <section dir="rtl">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-gray-900">سطح‌های اشتراک</h2>
                {!hasAvailablePlans && (
                  <p className="mt-2 text-sm leading-6 text-amber-700">
                    قیمت‌ها ثبت شده‌اند، اما در حال حاضر گزینه‌ای با موجودی قابل خرید نداریم.
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {plans.map((plan) => (
                <PlanCard key={plan.tier} plan={plan} />
              ))}
            </div>
          </section>
        ) : (
          <EmptyPsPlusState />
        )}

        {/* Capacity explainer */}
        <section dir="rtl" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-gray-900 mb-4">ظرفیت اکانت چیست؟</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(["CAPACITY_3", "CAPACITY_2", "CAPACITY_1"] as const).map((cap) => (
              <div key={cap} className="ui-lift-card rounded-xl bg-gray-50 p-4">
                <p className="font-bold text-gray-800 text-sm mb-1">{CAPACITY_LABEL[cap]}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{CAPACITY_DESC[cap]}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA to games */}
        <section dir="rtl" className="rounded-2xl px-8 py-8 text-white flex flex-col sm:flex-row items-center justify-between gap-4" style={{ background: "linear-gradient(135deg, #003087 0%, #0050b3 100%)" }}>
          <div>
            <h3 className="text-xl font-extrabold mb-1">دنبال بهترین قیمت بازی هستید؟</h3>
            <p className="text-white/70 text-sm">همه بازی‌های PS5 را از فروشندگان مختلف ایرانی مقایسه کنید.</p>
          </div>
          <Link
            href="/"
            className="shrink-0 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#003087] transition-[background-color,transform] duration-150 hover:bg-blue-50 active:scale-[0.98]"
          >
            مشاهده همه بازی‌ها
          </Link>
        </section>

      </main>

      <Disclaimer />
    </>
  );
}
