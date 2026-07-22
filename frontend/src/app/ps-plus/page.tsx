import Link from "next/link";
import Header from "@/components/Header";
import Disclaimer from "@/components/Disclaimer";

export const metadata = {
  title: "PS Plus | GameXS",
  description: "مقایسه قیمت اشتراک PS Plus در فروشندگان ایرانی: Essential، Extra و Premium",
};

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-green-500" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PSPlusLogo() {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-white text-lg" style={{ background: "linear-gradient(135deg, #003087 0%, #0050b3 100%)" }}>
        P
      </div>
      <span className="text-2xl font-black text-white tracking-tight">
        PS <span className="text-yellow-400">Plus</span>
      </span>
    </div>
  );
}

const TIERS = [
  {
    id: "essential",
    name: "Essential",
    color: "#2d68c4",
    badge: null,
    monthlyPrice: null,
    features: [
      "بازی‌های رایگان ماهانه (۲–۳ بازی)",
      "بازی آنلاین مالتی‌پلیر",
      "تخفیف‌های انحصاری فروشگاه",
      "فضای ذخیره‌سازی ابری ۱۰۰ گیگابایت",
      "اشتراک Spotify Premium",
    ],
    notIncluded: [
      "کاتالوگ بازی‌ها (Games Catalog)",
      "کلاسیک‌های PlayStation",
      "تریل رایگان بازی‌ها",
    ],
  },
  {
    id: "extra",
    name: "Extra",
    color: "#003087",
    badge: "محبوب‌ترین",
    monthlyPrice: null,
    features: [
      "همه مزایای Essential",
      "کاتالوگ بازی‌های PS4 و PS5 (بیش از ۴۰۰ بازی)",
      "دسترسی به بازی‌های Day One",
      "تخفیف‌های انحصاری بیشتر",
      "فضای ذخیره‌سازی ابری ۱۰۰ گیگابایت",
    ],
    notIncluded: [
      "کلاسیک‌های PlayStation",
      "استریم ابری بازی‌ها",
      "تریل رایگان بازی‌ها",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    color: "#1a1a2e",
    badge: "کامل‌ترین",
    monthlyPrice: null,
    features: [
      "همه مزایای Extra",
      "کاتالوگ کلاسیک‌های PS1، PS2، PS3 و PSP",
      "استریم ابری بازی‌ها",
      "تریل رایگان بازی‌های منتخب",
      "دسترسی زودهنگام به برخی عناوین",
      "فضای ذخیره‌سازی ابری ۱۰۰ گیگابایت",
    ],
    notIncluded: [],
  },
];

const CAPACITY_TYPES = [
  {
    id: 1,
    title: "ظرفیت ۱",
    subtitle: "اکانت کامل",
    description: "اکانت PSN به‌طور کامل تحویل می‌گیرید. فقط آفلاین قابل استفاده است.",
    pros: ["کامل‌ترین دسترسی", "مناسب برای یک نفر"],
    cons: ["آفلاین بازی کنید", "گران‌تر"],
  },
  {
    id: 2,
    title: "ظرفیت ۲",
    subtitle: "اکانت اشتراکی",
    description: "اکانت را با یک نفر دیگر به‌اشتراک می‌گذارید. آنلاین و آفلاین.",
    pros: ["آنلاین و آفلاین", "قیمت متعادل"],
    cons: ["اشتراکی با یک نفر دیگر"],
  },
  {
    id: 3,
    title: "ظرفیت ۳",
    subtitle: "اکانت اشتراکی (آنلاین)",
    description: "ارزان‌ترین حالت. آنلاین بازی کنید اما آفلاین محدودیت دارید.",
    pros: ["ارزان‌ترین گزینه", "مناسب بازی آنلاین"],
    cons: ["فقط آنلاین", "محدودیت آفلاین"],
  },
];

export default function PsPlusPage() {
  return (
    <>
      <Header />

      {/* Hero */}
      <div className="ps-header">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 text-center">
          <PSPlusLogo />
          <p className="mt-3 text-white/70 text-base max-w-xl mx-auto">
            مقایسه قیمت اشتراک PS Plus از فروشندگان معتبر ایران: Essential، Extra و Premium
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-14">

        {/* Coming soon banner */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 flex items-center gap-3" dir="rtl">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0" aria-hidden>
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <p className="text-amber-800 text-sm">
            <strong>به‌زودی:</strong> قیمت‌های اشتراک PS Plus از فروشندگان ایرانی به این صفحه اضافه می‌شود. فعلاً می‌توانید از طریق جستجو قیمت بازی‌ها را مقایسه کنید.
          </p>
        </div>

        {/* Tier comparison */}
        <section dir="rtl">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-6">سطح‌های PS Plus</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TIERS.map((tier) => (
              <div
                key={tier.id}
                className="relative rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col"
              >
                {/* Header band */}
                <div className="px-6 py-5 text-white" style={{ background: `linear-gradient(135deg, ${tier.color} 0%, ${tier.color}cc 100%)` }}>
                  <div className="h-[22px] mb-2 flex items-center">
                    {tier.badge && (
                      <span className="inline-block text-[11px] font-bold bg-yellow-400 text-black px-2.5 py-0.5 rounded-full">
                        {tier.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-black">PS Plus {tier.name}</h3>
                  <p className="text-white/60 text-xs mt-0.5">قیمت به‌زودی</p>
                </div>

                {/* Features */}
                <div className="px-6 py-5 flex-1 space-y-2.5">
                  {tier.features.map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <CheckIcon />
                      <span className="text-sm text-gray-700">{f}</span>
                    </div>
                  ))}
                  {tier.notIncluded.map((f) => (
                    <div key={f} className="flex items-start gap-2 opacity-40">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-400" aria-hidden>
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                      <span className="text-sm text-gray-500">{f}</span>
                    </div>
                  ))}
                </div>

                <div className="px-6 pb-5">
                  <Link
                    href="/"
                    className="block w-full text-center rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: `linear-gradient(135deg, ${tier.color} 0%, ${tier.color}cc 100%)` }}
                  >
                    مشاهده قیمت‌ها
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Account capacity explainer */}
        <section dir="rtl">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">ظرفیت اکانت چیست؟</h2>
          <p className="text-gray-500 text-sm mb-6">
            در ایران PS Plus از طریق خرید اکانت PSN فروخته می‌شود. هر اکانت می‌تواند به روش‌های مختلفی در اختیار شما قرار گیرد:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {CAPACITY_TYPES.map((cap) => (
              <div key={cap.id} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black text-white mb-4 shrink-0" style={{ background: "linear-gradient(135deg, #003087 0%, #0050b3 100%)" }}>
                  {cap.id}
                </div>
                <h3 className="font-bold text-gray-900 text-base">{cap.title}</h3>
                <p className="text-xs font-medium text-blue-600 mb-2">{cap.subtitle}</p>
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">{cap.description}</p>
                <div className="space-y-1.5">
                  {cap.pros.map((p) => (
                    <div key={p} className="flex items-center gap-2">
                      <CheckIcon />
                      <span className="text-xs text-gray-600">{p}</span>
                    </div>
                  ))}
                  {cap.cons.map((c) => (
                    <div key={c} className="flex items-center gap-2 opacity-50">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-400" aria-hidden>
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                      <span className="text-xs text-gray-500">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section dir="rtl" className="rounded-2xl bg-gradient-to-l from-[#003087] to-[#0050b3] px-8 py-8 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
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
