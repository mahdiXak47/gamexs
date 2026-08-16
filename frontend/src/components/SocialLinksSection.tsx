const SOCIAL_LINKS = [
  {
    label: "کانال تلگرام گیم‌ایکس‌اس",
    href: "https://t.me/gamexschannel",
    accent: "from-[#2f8df3] to-[#2558f0]",
    glow: "shadow-[0_18px_42px_rgba(37,88,240,0.22)]",
    icon: (
      <svg width="54" height="54" viewBox="0 0 64 64" fill="none" aria-hidden>
        <path
          d="M55.1 11.7 9.8 29.1c-3.1 1.2-3.1 3 0 3.9l11.6 3.6 4.4 13.5c.6 1.8 1.2 2.5 2.4 2.5 1.1 0 1.7-.5 2.4-1.2l6.4-6.2 11.8 8.7c2.2 1.2 3.7.6 4.2-2l7.6-35.7c.8-3.1-1.2-4.5-3.5-3.5Z"
          fill="white"
        />
        <path
          d="m24.6 35.7 22.6-14.3c1.1-.7 2.1-.3 1.3.4L30.2 38.4l-.7 7.3-4.9-10Z"
          fill="#2f8df3"
        />
      </svg>
    ),
  },
  {
    label: "صفحه اینستاگرام گیم‌ایکس‌اس",
    href: "https://www.instagram.com/gamexs.ir/",
    accent: "from-[#ef4444] via-[#b735f0] to-[#6d28d9]",
    glow: "shadow-[0_18px_42px_rgba(109,40,217,0.22)]",
    icon: (
      <svg width="54" height="54" viewBox="0 0 64 64" fill="none" aria-hidden>
        <rect x="11" y="11" width="42" height="42" rx="12" stroke="white" strokeWidth="5" />
        <circle cx="32" cy="32" r="10" stroke="white" strokeWidth="5" />
        <circle cx="44" cy="20" r="3.5" fill="white" />
      </svg>
    ),
  },
];

export default function SocialLinksSection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6" aria-label="شبکه‌های اجتماعی گیم‌ایکس‌اس">
      <div className="grid gap-5 md:grid-cols-2" dir="ltr">
        {SOCIAL_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`group relative flex min-h-28 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-l ${link.accent} px-6 py-6 text-white ${link.glow} transition-[transform,box-shadow,filter] duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue focus-visible:ring-offset-2`}
            dir="rtl"
          >
            <span className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-[radial-gradient(circle_at_28%_28%,rgba(255,255,255,0.24),transparent_34%)]" />
            <span className="relative flex items-center gap-4 text-lg font-black sm:text-xl">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center" aria-hidden>
                {link.icon}
              </span>
              <span>{link.label}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m15 18-6-6 6-6" />
              </svg>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
