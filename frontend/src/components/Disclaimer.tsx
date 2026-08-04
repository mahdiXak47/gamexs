const badges = [
  {
    title: "پشتیبانی",
    subtitle: "۲۴ ساعته",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 12a8 8 0 0 1 16 0" />
        <path d="M4 12v3a2 2 0 0 0 2 2h1v-7H6a2 2 0 0 0-2 2Z" />
        <path d="M20 12v3a2 2 0 0 1-2 2h-1v-7h1a2 2 0 0 1 2 2Z" />
        <path d="M8 20c1.1.7 2.4 1 4 1s2.9-.3 4-1" />
        <path d="M9 9a3 3 0 0 1 6 0" />
      </svg>
    ),
  },
  {
    title: "پرداخت",
    subtitle: "امن و مطمئن",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "ضمانت",
    subtitle: "بازگشت ۱۰۰٪ پول",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="8" r="6" />
        <path d="M8.5 13.5 7 22l5-3 5 3-1.5-8.5" />
      </svg>
    ),
  },
];

export default function Disclaimer() {
  return (
    <section className="w-full bg-white border-t border-gray-200 py-6" dir="rtl" aria-label="ویژگی‌های خدمات">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 divide-gray-200">
          {badges.map((badge, i) => (
            <div
              key={badge.title}
              className={`flex items-center justify-center gap-3 py-4 sm:py-2 sm:px-8 ${
                i > 0 ? "sm:border-s sm:border-gray-200" : ""
              }`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ps-blue/10 text-ps-blue">
                {badge.icon}
              </div>
              <div className="flex flex-col items-end text-right leading-snug">
                <span className="text-sm font-bold text-gray-900">{badge.title}</span>
                {badge.subtitle && (
                  <span className="text-xs text-gray-500 mt-0.5">{badge.subtitle}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
