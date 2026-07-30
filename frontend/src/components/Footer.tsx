import Image from "next/image"
import Link from "next/link"

const quickLinks = [
  { label: "همه بازی‌ها", href: "/" },
  { label: "PS Plus", href: "/ps-plus" },
  { label: "بازی‌های پیش‌رو", href: "/upcoming" },
  { label: "پشتیبانی", href: "#" },
]

// href is "#" for every platform — none of these accounts exist yet.
// Replace with the real profile URL as each one launches.
const socialLinks = [
  {
    label: "یوتیوب",
    href: "#",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="6" width="20" height="12" rx="4" />
        <path d="m10 9 5 3-5 3Z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "اینستاگرام",
    href: "#",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "توییتر",
    href: "#",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 4l16 16M20 4 4 20" />
      </svg>
    ),
  },
  {
    label: "تلگرام",
    href: "#",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="m8 12 8-4-2.5 9-2-3.5L8 12Z" />
      </svg>
    ),
  },
]

export default function Footer() {
  return (
    <footer
      dir="rtl"
      style={{ background: "linear-gradient(135deg, #003087 0%, #0050b3 100%)" }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-12 pb-8">

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">

          {/* Branding */}
          <div className="flex flex-col gap-4">
            <Image src="/logos/logo7.png" alt="GameXS" width={971} height={347} className="h-8 w-auto" />
            <p className="text-blue-200 text-sm leading-relaxed max-w-xs">
              مقایسه قیمت بازی، اکانت و اشتراک PS5 بین فروشندگان معتبر ایران.
              خرید نهایی مستقیم از سایت فروشنده انجام می‌شود.
            </p>
            <div className="flex items-center gap-2">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-blue-200 transition-colors hover:bg-white/20 hover:text-white"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-white font-bold text-sm mb-4">دسترسی سریع</h3>
            <ul className="flex flex-col gap-2.5">
              {quickLinks.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-blue-200 hover:text-white text-sm transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Enamad trust seal */}
          <div className="flex flex-col gap-4">
            <h3 className="text-white font-bold text-sm">نماد اعتماد الکترونیکی</h3>
            {/*
              Enamad verification requires the non-standard `code` attribute on <img>
              and exact referrerpolicy values. dangerouslySetInnerHTML preserves them.
            */}
            <div
              dangerouslySetInnerHTML={{
                __html: `<a referrerpolicy="origin" target="_blank" href="https://trustseal.enamad.ir/?id=763776&Code=8AVZTb8i9acELPOor6KtTQdBDVvmSMab" rel="noopener"><img referrerpolicy="origin" src="https://trustseal.enamad.ir/logo.aspx?id=763776&Code=8AVZTb8i9acELPOor6KtTQdBDVvmSMab" alt="نماد اعتماد الکترونیکی" style="cursor:pointer;width:100px;height:auto;border-radius:8px" code="8AVZTb8i9acELPOor6KtTQdBDVvmSMab"></a>`,
              }}
            />
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/20 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-blue-200">
          <span>تمامی حقوق برای گیم‌ایکس‌اس محفوظ است</span>
          <span>قیمت‌ها هر چند ساعت یک‌بار به‌روزرسانی می‌شوند</span>
        </div>

      </div>
    </footer>
  )
}
