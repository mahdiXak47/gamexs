import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import Disclaimer from "@/components/Disclaimer";
import {
  getPsPlusPlan,
  SLUG_TIER,
  TIER_LABEL,
  TIER_COLOR,
  TIER_SLUG,
  CAPACITY_LABEL,
  CAPACITY_DESC,
  type PsPlusPlan,
  type PsPlusOption,
} from "@/lib/ps-plus-repo";
import { formatToman } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return Object.keys(SLUG_TIER).map((slug) => ({ tier: slug }));
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

function OptionCard({ opt, color }: { opt: PsPlusOption; color: string }) {
  const available = opt.latestPrice != null && opt.inStock;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Capacity header */}
      <div className="px-5 py-4 flex items-center justify-between gap-3" style={{ background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`, borderBottom: `2px solid ${color}30` }}>
        <div>
          <h3 className="font-extrabold text-gray-900 text-base">{CAPACITY_LABEL[opt.capacity]}</h3>
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{CAPACITY_DESC[opt.capacity]}</p>
        </div>
        <div className="text-left shrink-0">
          {opt.latestPrice != null ? (
            <>
              <p className="text-lg font-black text-gray-900">{formatToman(opt.latestPrice)}</p>
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
      <div className="px-5 py-4 flex items-center justify-between gap-3">
        <div dir="rtl">
          <p className="text-xs text-gray-400 mb-0.5">فروشنده</p>
          <p className="text-sm font-semibold text-gray-700">{opt.sellerName}</p>
        </div>
        <a
          href={opt.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-opacity ${
            available
              ? "text-white hover:opacity-90"
              : "bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none"
          }`}
          style={available ? { background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)` } : undefined}
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
  const lowestPrice = Math.min(...plan.options.map((o) => o.latestPrice ?? Infinity));

  // Other tiers for cross-links
  const otherTiers = (["ESSENTIAL", "EXTRA", "PREMIUM"] as const).filter((t) => t !== plan.tier);

  return (
    <>
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
              {lowestPrice < Infinity && (
                <p className="text-white/70 text-sm mt-1">از {formatToman(lowestPrice)}</p>
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
            {plan.options.map((opt) => (
              <OptionCard key={opt.capacity} opt={opt} color={color} />
            ))}
          </div>

          {/* RIGHT: features */}
          <aside className="space-y-4" dir="rtl">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
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
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
              <h2 className="text-base font-extrabold text-gray-900 mb-3">سایر سطح‌ها</h2>
              <div className="space-y-2">
                {otherTiers.map((t) => (
                  <Link
                    key={t}
                    href={`/ps-plus/${TIER_SLUG[t]}`}
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700 hover:text-gray-900"
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

      </main>

      <Disclaimer />
    </>
  );
}
