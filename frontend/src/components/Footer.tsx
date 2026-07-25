import Link from "next/link"

const quickLinks = [
  { label: "همه بازی‌ها", href: "/" },
  { label: "PS Plus", href: "/ps-plus" },
  { label: "بازی‌های پیش‌رو", href: "/upcoming" },
  { label: "پشتیبانی", href: "#" },
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
            <span className="text-white text-2xl font-extrabold tracking-wide">
              Game<span className="text-yellow-300">XS</span>
            </span>
            <p className="text-blue-200 text-sm leading-relaxed max-w-xs">
              مقایسه قیمت بازی، اکانت و اشتراک PS5 بین فروشندگان معتبر ایران.
              خرید نهایی مستقیم از سایت فروشنده انجام می‌شود.
            </p>
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
