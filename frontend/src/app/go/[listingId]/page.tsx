import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getRedirectTarget, recordClick } from "@/lib/clicks";
import { formatToman } from "@/lib/format";
import { purchasePathLabel } from "@/lib/purchase-options";
import { RedirectCountdown } from "./RedirectCountdown";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "در حال انتقال به فروشگاه",
  robots: { index: false, follow: false },
};

// Interstitial for "خرید از فروشگاه": counts the referral server-side, then
// forwards to the seller. Works without JavaScript via the meta refresh.
export default async function GoPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const target = await getRedirectTarget(listingId);
  if (!target) notFound();
  const claim = await recordClick(target, await headers());

  return (
    <main id="main-content" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <meta httpEquiv="refresh" content={`3;url=${target.source_url}`} />
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-black/5 bg-white shadow-[0_24px_60px_-28px_rgba(0,48,135,0.35)]">
        <div className="flex flex-col items-center gap-5 px-6 pb-6 pt-8 text-center">
          <Image src="/logos/logo2.png" alt="GameXS" width={48} height={48} className="h-12 w-auto" priority />
          <p className="text-sm text-gray-500">در حال انتقال از GameXS به فروشگاه</p>
          <h1 className="-mt-3 text-2xl font-extrabold text-ps-night">{target.seller_name}</h1>

          <HandoffArt />

          <div className="w-full rounded-2xl bg-ps-blue-light/60 px-4 py-3 text-start">
            <p className="truncate text-sm font-bold text-ps-night">{target.game_title}</p>
            <p className="mt-1 flex items-center justify-between gap-3 text-xs text-gray-600">
              <span>{purchasePathLabel(target.product_type, target.tier)}</span>
              {target.price_toman ? <span className="font-bold text-ps-blue">{formatToman(target.price_toman)} تومان</span> : null}
            </p>
          </div>

          <RedirectCountdown url={target.source_url} claim={claim} />
          <p className="text-xs leading-6 text-gray-500">
            قیمت و موجودی نهایی را پیش از پرداخت در سایت {target.seller_name} بررسی کنید. GameXS فقط قیمت‌ها را مقایسه می‌کند و در خرید نقشی ندارد.
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-black/5 bg-gray-50 px-6 py-4">
          <Link href={`/games/${target.game_slug}`} className="text-sm text-gray-500 transition-colors hover:text-ps-blue">
            بازگشت به GameXS
          </Link>
          <a
            href={target.source_url}
            rel="nofollow noopener"
            className="inline-flex min-h-11 items-center justify-center rounded-3xl bg-ps-blue px-5 text-sm font-bold text-white transition-colors hover:bg-ps-blue-hover"
          >
            ورود به سایت {target.seller_domain}
          </a>
        </div>
      </section>
    </main>
  );
}

/** GameXS version of the hand-off art: a PS5 controller gliding into a shopping bag. */
function HandoffArt() {
  return (
    <svg viewBox="0 0 220 110" className="h-28 w-auto" role="img" aria-label="انتقال به فروشگاه">
      <style>{`
        @keyframes gx-glide { 0% { transform: translateX(-46px); opacity: 0 } 25% { opacity: 1 } 70% { transform: translateX(34px); opacity: 1 } 100% { transform: translateX(34px); opacity: 0 } }
        @keyframes gx-bob { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        .gx-pad { animation: gx-glide 1.8s ease-in-out infinite; }
        .gx-bag { animation: gx-bob 1.8s ease-in-out infinite; transform-origin: center; }
        @media (prefers-reduced-motion: reduce) { .gx-pad, .gx-bag { animation: none; } }
      `}</style>
      <path d="M30 86 H190" stroke="#c9d6ea" strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round" />
      <g className="gx-pad">
        <g transform="translate(58 44)">
          <path d="M-26 6c0-14 9-22 26-22s26 8 26 22c0 12-4 22-11 22-6 0-8-8-15-8s-9 8-15 8c-7 0-11-10-11-22Z" fill="#003087" />
          <circle cx="-12" cy="2" r="5" fill="#e8f0fb" />
          <circle cx="12" cy="0" r="2.4" fill="#f6b829" />
          <circle cx="17" cy="5" r="2.4" fill="#e8f0fb" />
          <circle cx="7" cy="5" r="2.4" fill="#e8f0fb" />
        </g>
      </g>
      <g className="gx-bag">
        <path d="M150 40h44l-5 46h-34Z" fill="#0050b3" />
        <path d="M162 40v-6a10 10 0 0 1 20 0v6" fill="none" stroke="#003087" strokeWidth="4" strokeLinecap="round" />
        <path d="M163 60l6 6 12-13" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
