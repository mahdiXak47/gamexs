import Link from "next/link";
import Header from "@/components/Header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "صفحه پیدا نشد",
  robots: {
    index: false,
    follow: false,
  },
};

const links = [
  { label: "همه بازی‌ها", href: "/" },
  { label: "بازی‌های پیش‌رو", href: "/upcoming" },
  { label: "PS Plus", href: "/ps-plus" },
  { label: "اکانت PS5", href: "/account-games" },
];

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main-content" className="flex-1">
        <section className="ps-header text-white">
          <div className="mx-auto grid min-h-[calc(100dvh-360px)] max-w-7xl content-center gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_360px] lg:items-center">
            <div className="max-w-2xl">
              <p className="mb-4 font-mono text-sm font-bold text-blue-100">404</p>
              <h1 className="text-3xl font-black leading-tight sm:text-5xl">
                صفحه‌ای که دنبال آن هستید پیدا نشد
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-8 text-blue-100 sm:text-base">
                ممکن است آدرس تغییر کرده باشد یا این بازی هنوز در فهرست گیم‌ایکس‌اس موجود نباشد.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-white px-5 text-sm font-bold text-ps-blue transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ps-blue"
                >
                  بازگشت به بازی‌ها
                </Link>
                <Link
                  href="/upcoming"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-white/40 px-5 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  بازی‌های پیش‌رو
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-white/20 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur">
              <p className="text-sm font-bold text-white">مسیرهای پیشنهادی</p>
              <div className="mt-4 grid gap-2">
                {links.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between rounded-md border border-white/15 px-4 py-3 text-sm text-blue-50 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <span>{item.label}</span>
                    <span aria-hidden dir="ltr">←</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
