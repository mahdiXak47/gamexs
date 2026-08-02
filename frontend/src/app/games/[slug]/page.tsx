import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip } from "@heroui/react";
import CoverArt from "@/components/CoverArt";
import Disclaimer from "@/components/Disclaimer";
import GamePreorderBanner from "@/components/GamePreorderBanner";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import PsStorePriceBadges from "@/components/PsStorePriceBadges";
import PurchaseTypeSelector from "@/components/PurchaseTypeSelector";
import ScreenshotGallery from "@/components/ScreenshotGallery";
import WishlistButton from "@/components/WishlistButton";
import { formatToman, toPersianDigits } from "@/lib/format";
import { getGameBySlug, getGameStoreInfo } from "@/lib/games-repo";
import { lowestPrice, lowestValidPrice, storeCount } from "@/lib/purchase-options";
import { SITE_URL, tomanToRial } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return {};

  const price = lowestValidPrice(game);
  const stores = storeCount(game);
  const priceText = price !== null ? `از ${formatToman(price)} تومان در ${stores} فروشگاه` : "";
  const title = `خرید ${game.title} برای PS5 — قیمت و مقایسه فروشندگان`;
  const description = [priceText, game.details?.summary]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 300) || `مقایسه قیمت اکانت، دیسک و اشتراک ${game.title} برای PS5 بین فروشندگان ایرانی`;
  const image = game.keyArtUrl ?? game.coverUrl ?? undefined;

  return {
    title,
    description,
    keywords: game.details?.keywords,
    alternates: { canonical: `/games/${slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/games/${slug}`,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const storeInfo = await getGameStoreInfo(game.dbId);

  const price  = lowestPrice(game);
  const stores = storeCount(game);
  const d      = game.details;
  // Screenshots are landscape S3 images — much better quality for a wide hero
  // than the portrait cover. For IGDB cover fallbacks swap the tiny size token
  // with t_1080p (1920×1080) so the blowup is at least at native resolution.
  const highResCover = game.coverUrl?.replace("t_cover_big", "t_1080p") ?? game.coverUrl ?? null;
  const heroBg = game.keyArtUrl ?? game.screenshots[0] ?? highResCover;
  const hasArt = !!heroBg;

  const persianReleaseDate = game.releaseDate
    ? new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(
        new Date(game.releaseDate)
      )
    : null;

  // priceToman = 0 shows up on some out-of-stock scraped listings (a scraper
  // artifact, not a real price) — excluded here so structured data never
  // claims a zero price, which fails Google's Merchant/Rich Results validation.
  const allOffers = game.purchaseOptions.flatMap((option) =>
    option.offers
      .filter((offer) => offer.priceToman > 0)
      .map((offer) => ({
        "@type": "Offer",
        name: option.label,
        url: offer.listingUrl,
        priceCurrency: "IRR",
        price: tomanToRial(offer.priceToman),
        availability: offer.inStock
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        seller: { "@type": "Organization", name: offer.sellerName },
      }))
  );

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: game.title,
    description: d?.summary ?? undefined,
    image: game.coverUrl ?? game.keyArtUrl ?? undefined,
    brand: game.publisher ? { "@type": "Organization", name: game.publisher } : undefined,
    ...(allOffers.length > 0 && {
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "IRR",
        lowPrice: Math.min(...allOffers.map((o) => o.price)),
        offerCount: allOffers.length,
        offers: allOffers,
      },
    }),
  };

  // Genre: prefer IGDB list, fallback to scraper genreLabel
  const genreValue =
    d?.genres?.length
      ? d.genres.join("، ")
      : game.genreLabel ?? null;

  const facts: { label: string; value: string }[] = [
    { label: "ناشر",         value: game.publisher ?? "—" },
    ...(d?.developers?.length
      ? [{ label: "سازنده",   value: d.developers.join("، ") }] : []),
    ...(persianReleaseDate
      ? [{ label: "تاریخ انتشار", value: persianReleaseDate }]
      : [{ label: "سال انتشار", value: game.releaseYear ? toPersianDigits(game.releaseYear) : "—" }]),
    ...(genreValue
      ? [{ label: "ژانر",       value: genreValue }] : []),
    ...(d?.themes?.length
      ? [{ label: "تم",         value: d.themes.join("، ") }] : []),
    ...((d?.gameModes?.length || d?.playerPerspectives?.length)
      ? [{ label: "سبک بازی",  value: [...(d?.gameModes ?? []), ...(d?.playerPerspectives ?? [])].join("، ") }]
      : []),
    ...((d?.franchises?.length || d?.series?.length)
      ? [{ label: "فرانچایز",  value: [...(d?.franchises ?? []), ...(d?.series ?? [])].filter((v, i, a) => a.indexOf(v) === i).join("، ") }]
      : []),
    ...(d?.gameEngines?.length
      ? [{ label: "موتور بازی", value: d.gameEngines.join("، ") }] : []),
    ...(stores > 0
      ? [{ label: "فروشندگان", value: `${toPersianDigits(stores)} فروشگاه` }] : []),
  ];

  return (
    <>
      <JsonLd data={productJsonLd} />
      <Header />
      <main className="flex-1">

        {/* ── Hero section — exactly one viewport tall ── */}
        <div className="relative overflow-hidden h-[calc(100dvh-60px)]">

          {/* Background image — key art preferred, cover as fallback */}
          {hasArt && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={heroBg!}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          )}

          {/* Dark gradient overlay — ensures ≥4.5:1 contrast for white text */}
          {hasArt && (
            <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/65 to-black/80" />
          )}

          {/* Content — fills full hero height, centers grid vertically */}
          <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 h-full flex flex-col py-6">
            <Link
              href="/"
              className={`inline-flex items-center gap-2 text-sm transition-colors shrink-0 ${
                hasArt
                  ? "text-white/65 hover:text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              ← بازگشت به فهرست بازی‌ها
            </Link>

            {/* Hero grid — cover LEFT (RTL), info RIGHT — vertically centered */}
            <div className="flex-1 mt-4 grid grid-cols-1 gap-8 md:grid-cols-[1fr_minmax(0,32%)] items-center content-center">

              {/* ── Info column (RIGHT in RTL) ── */}
              <div className="flex flex-col gap-0">

                {/* Chips + wishlist */}
                <div className="flex flex-wrap items-center gap-2">
                  <Chip size="sm" className="bg-ps-blue text-white border-0 font-bold">PS5</Chip>
                  {game.genreLabel && (
                    <Chip
                      variant="soft"
                      color="default"
                      size="sm"
                      className={hasArt ? "bg-white/15 text-white border-white/20" : ""}
                    >
                      {game.genreLabel}
                    </Chip>
                  )}
                  <div className="mr-auto">
                    <WishlistButton gameId={game.dbId} />
                  </div>
                </div>

                {/* Title + price card — same row, top-aligned */}
                <div className="mt-3 flex items-start gap-4">
                  <h1 dir="auto" className={`flex-1 text-right text-3xl font-extrabold leading-tight sm:text-4xl ${
                    hasArt ? "text-white" : ""
                  }`}>
                    {game.title}
                  </h1>

                  {price !== null && (
                    <div className={`shrink-0 rounded-2xl px-4 py-3 text-start ${
                      hasArt
                        ? "border border-white/20 bg-white/10 backdrop-blur-sm"
                        : "border border-success/30 bg-success/10"
                    }`}>
                      <p className={`text-xs font-medium ${hasArt ? "text-emerald-300" : "text-success"}`}>
                        کمترین قیمت
                      </p>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className={`price-figure text-lg font-extrabold leading-none ${
                          hasArt ? "text-white" : ""
                        }`}>
                          {formatToman(price)}
                        </span>
                        <span className={`text-xs ${hasArt ? "text-white/60" : "text-muted"}`}>
                          تومان
                        </span>
                      </div>
                      <p className={`mt-0.5 text-xs ${hasArt ? "text-white/60" : "text-muted"}`}>
                        در {toPersianDigits(stores)} فروشگاه
                      </p>
                    </div>
                  )}
                </div>

                {/* Summary */}
                {d?.summary && (
                  <p className={`mt-4 text-sm leading-relaxed line-clamp-3 ${
                    hasArt ? "text-white/70" : "text-gray-500"
                  }`}>
                    {d.summary}
                  </p>
                )}

                {/* Divider */}
                <div className={`mt-6 h-px ${hasArt ? "bg-white/15" : "bg-gray-200"}`} />

                {/* Metadata grid */}
                <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  {facts.map(({ label, value }) => (
                    <div key={label} className="min-w-0">
                      <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${
                        hasArt ? "text-white/40" : "text-gray-400"
                      }`}>
                        {label}
                      </p>
                      <p className={`text-sm font-semibold leading-snug break-words ${
                        hasArt ? "text-white" : "text-gray-800"
                      }`}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Cover art + PS Store badges (LEFT in RTL) ── */}
              <div className="flex flex-col gap-3">
                <CoverArt
                  coverUrl={game.coverUrl}
                  title={game.title}
                  initial={game.coverInitial}
                  className="w-full aspect-[3/4] max-h-[525px] rounded-2xl shadow-2xl"
                  priority
                />
                {storeInfo && <PsStorePriceBadges info={storeInfo} />}
              </div>
            </div>
          </div>
        </div>

        {/* Pre-order countdown — only renders when release date is in the future */}
        {game.releaseDate && (
          <GamePreorderBanner
            releaseDate={game.releaseDate}
            keyArtUrl={game.keyArtUrl}
            title={game.title}
          />
        )}

        {/* Screenshot gallery */}
        <ScreenshotGallery screenshots={game.screenshots} />

        <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
          <PurchaseTypeSelector options={game.purchaseOptions} />
        </div>
      </main>
      <Disclaimer />
    </>
  );
}
