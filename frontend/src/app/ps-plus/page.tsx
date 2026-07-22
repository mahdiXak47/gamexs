import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import Disclaimer from "@/components/Disclaimer";
import {
  getAllPsPlusPlans,
  TIER_LABEL,
  TIER_COLOR,
  TIER_SLUG,
  CAPACITY_LABEL,
  CAPACITY_DESC,
  type PsPlusPlan,
} from "@/lib/ps-plus-repo";
import { formatToman } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "PS Plus | GameXS",
  description: "مقایسه قیمت اشتراک PS Plus در فروشندگان ایرانی: Essential، Extra و Premium",
};

function TierBadge({ label, badge }: { label: string; badge: string | null }) {
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

function PlanCard({ plan }: { plan: PsPlusPlan }) {
  const color = TIER_COLOR[plan.tier];
  const slug  = TIER_SLUG[plan.tier];
  const lowestPrice = Math.min(...plan.options.map((o) => o.latestPrice ?? Infinity));

  return (
    <div className="relative rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Colored header */}
      <div className="px-6 py-5 text-white" style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)` }}>
        <TierBadge label={TIER_LABEL[plan.tier]} badge={TIER_BADGE[plan.tier]} />

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
            {lowestPrice < Infinity && (
              <p className="text-white/70 text-xs mt-0.5">
                از {formatToman(lowestPrice)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Capacity rows */}
      <div className="px-6 py-4 flex-1 divide-y divide-gray-100" dir="rtl">
        {plan.options.map((opt) => (
          <div key={opt.capacity} className="py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">{CAPACITY_LABEL[opt.capacity]}</p>
              <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{CAPACITY_DESC[opt.capacity]}</p>
            </div>
            <div className="text-left shrink-0">
              {opt.latestPrice != null ? (
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
          className="block w-full text-center rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)` }}
        >
          مشاهده جزئیات
        </Link>
      </div>
    </div>
  );
}

export default async function PsPlusPage() {
  const plans = await getAllPsPlusPlans();

  return (
    <>
      <Header />

      <div className="ps-header">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 text-center">
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
            <h2 className="text-xl font-extrabold text-gray-900 mb-5">سطح‌های اشتراک</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {plans.map((plan) => (
                <PlanCard key={plan.tier} plan={plan} />
              ))}
            </div>
          </section>
        ) : (
          <p className="text-center text-gray-400 py-20">قیمتی در دسترس نیست</p>
        )}

        {/* Capacity explainer */}
        <section dir="rtl" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-gray-900 mb-4">ظرفیت اکانت چیست؟</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(["CAPACITY_3", "CAPACITY_2", "CAPACITY_1"] as const).map((cap) => (
              <div key={cap} className="rounded-xl bg-gray-50 p-4">
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
            className="shrink-0 bg-white text-[#003087] font-bold px-6 py-3 rounded-full text-sm hover:bg-blue-50 transition-colors"
          >
            مشاهده همه بازی‌ها
          </Link>
        </section>

      </main>

      <Disclaimer />
    </>
  );
}
