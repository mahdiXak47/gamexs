const badges = [
  {
    title: "ارسال سریع",
    subtitle: "",
    icon: (
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden>
        {/* Lines representing a list/document */}
        <rect x="6" y="8" width="28" height="4" rx="2" fill="#c8c8c8" />
        <rect x="6" y="16" width="22" height="4" rx="2" fill="#c8c8c8" />
        <rect x="6" y="24" width="26" height="4" rx="2" fill="#c8c8c8" />
        <rect x="6" y="32" width="18" height="4" rx="2" fill="#c8c8c8" />
        {/* Red accent bookmark/tag on the right */}
        <rect x="36" y="4" width="12" height="32" rx="2" fill="#e53e3e" />
        <polygon points="36,36 48,36 42,44" fill="#e53e3e" />
        {/* White lines inside the bookmark */}
        <rect x="39" y="10" width="6" height="2" rx="1" fill="white" />
        <rect x="39" y="15" width="6" height="2" rx="1" fill="white" />
        <rect x="39" y="20" width="6" height="2" rx="1" fill="white" />
      </svg>
    ),
  },
  {
    title: "پرداخت",
    subtitle: "امن و مطمئن",
    icon: (
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden>
        {/* Lock body */}
        <rect x="11" y="24" width="30" height="22" rx="4" fill="#c8c8c8" />
        {/* Lock shackle */}
        <path d="M17 24V18a9 9 0 0 1 18 0v6" stroke="#c8c8c8" strokeWidth="4" strokeLinecap="round" fill="none" />
        {/* Red keyhole */}
        <circle cx="26" cy="34" r="4" fill="#e53e3e" />
        <rect x="24" y="36" width="4" height="5" rx="1" fill="#e53e3e" />
      </svg>
    ),
  },
  {
    title: "ضمانت",
    subtitle: "بازگشت ۱۰۰٪ پول",
    icon: (
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden>
        {/* Stack of bills */}
        <rect x="4" y="20" width="36" height="22" rx="3" fill="#c8c8c8" />
        <rect x="4" y="15" width="36" height="8" rx="3" fill="#b0b0b0" />
        <rect x="4" y="10" width="36" height="8" rx="3" fill="#c8c8c8" />
        {/* Oval on top bill */}
        <ellipse cx="22" cy="21" rx="7" ry="5" fill="#adadad" />
        {/* Red circular arrow */}
        <path d="M34 6 a10 10 0 1 1 -1 0" stroke="#e53e3e" strokeWidth="3" strokeLinecap="round" fill="none" />
        <polygon points="33,3 37,7 29,8" fill="#e53e3e" />
      </svg>
    ),
  },
]

export default function Disclaimer() {
  return (
    <section className="w-full bg-[#f2f2f2] border-t border-gray-200 py-5" dir="rtl" aria-label="ویژگی‌های خدمات">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-gray-300">
          {badges.map((badge) => (
            <div key={badge.title} className="flex items-center justify-center gap-4 py-4 sm:py-2 sm:px-8">
              <div className="flex flex-col items-end text-right leading-snug">
                <span className="text-sm font-bold text-gray-600">{badge.title}</span>
                {badge.subtitle && (
                  <span className="text-sm text-gray-500">{badge.subtitle}</span>
                )}
              </div>
              <div className="shrink-0">{badge.icon}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
