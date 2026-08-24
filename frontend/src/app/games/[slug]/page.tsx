import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { Chip } from "@heroui/react";
import Breadcrumb from "@/components/Breadcrumb";
import CoverArt from "@/components/CoverArt";
import Disclaimer from "@/components/Disclaimer";
import FaqSection from "@/components/FaqSection";
import GamePreorderBanner from "@/components/GamePreorderBanner";
import GameReviewsSection from "@/components/GameReviewsSection";
import GameVersions from "@/components/GameVersions";
import GamePageScrollReset from "@/components/GamePageScrollReset";
import GameViewTracker from "@/components/GameViewTracker";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import PsStorePriceBadges from "@/components/PsStorePriceBadges";
import PurchaseTypeSelector from "@/components/PurchaseTypeSelector";
import ScreenshotGallery from "@/components/ScreenshotGallery";
import SimilarGames from "@/components/SimilarGames";
import WishlistButton from "@/components/WishlistButton";
import { formatToman, toPersianDigits } from "@/lib/format";
import { genreForGame } from "@/lib/genres";
import type { PsStoreInfo } from "@/lib/games-repo";
import { getGameBySlug, getGameStoreInfo, getSimilarGames, getSimilarGamesByDeveloper, getGameVersions } from "@/lib/games-repo";
import { lowestAvailableOffer, lowestValidPrice, storeCount } from "@/lib/purchase-options";
import { faqPageJsonLd, gamePurchaseFaqs, SITE_URL, tomanToRial } from "@/lib/seo";

export const dynamic = "force-dynamic";

function secondaryValue<T>(result: PromiseSettledResult<T>, fallback: T, label: string): T {
  if (result.status === "fulfilled") return result.value;
  console.error(`Game detail secondary data failed: ${label}`, result.reason);
  return fallback;
}

function secondaryFailed(result: PromiseSettledResult<unknown>): boolean {
  return result.status === "rejected";
}

function DegradedNotice({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6" dir="rtl">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium leading-6 text-amber-800">
        {children}
      </div>
    </div>
  );
}

function InlineDegradedNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-center text-[11px] leading-5 text-white/70 backdrop-blur-sm" dir="rtl">
      {children}
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game || storeCount(game) === 0) notFound();

  const price = lowestValidPrice(game);
  const stores = storeCount(game);
  const priceText = price !== null ? `از ${formatToman(price)} تومان در ${stores} فروشگاه` : "";
  const title = `خرید ${game.title} برای PS5 — قیمت و مقایسه فروشندگان`;
  const description = [priceText, game.details?.summary]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 300) || `مقایسه قیمت اکانت، دیسک و اشتراک ${game.title} برای PS5 بین فروشندگان ایرانی`;
  const image = game.mainBackgroundImageUrl ?? game.coverUrl ?? undefined;

  return {
    title,
    description,
    keywords: game.details?.keywords,
    alternates: { canonical: `/games/${game.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/games/${game.slug}`,
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
  if (!game || storeCount(game) === 0) notFound();
  if (slug !== game.slug) permanentRedirect(`/games/${game.slug}`);

  const [storeInfoResult, gameVersionsResult, similarGamesResult, similarGamesByDeveloperResult] = await Promise.allSettled([
    getGameStoreInfo(game.dbId),
    getGameVersions(game.dbId, game.title),
    getSimilarGames(game.dbId, game.genres),
    getSimilarGamesByDeveloper(game.dbId, game.developers),
  ]);
  const storeInfo = secondaryValue(storeInfoResult, null, "ps-store-info");
  const gameVersions = secondaryValue(gameVersionsResult, [], "game-versions");
  const similarGames = secondaryValue(similarGamesResult, [], "similar-games");
  const similarGamesByDeveloper = secondaryValue(similarGamesByDeveloperResult, [], "similar-games-by-developer");
  const storeInfoUnavailable = secondaryFailed(storeInfoResult);
  const gameVersionsUnavailable = secondaryFailed(gameVersionsResult);
  const similarGamesUnavailable = secondaryFailed(similarGamesResult);
  const similarGamesByDeveloperUnavailable = secondaryFailed(similarGamesByDeveloperResult);

  const lowestOffer = lowestAvailableOffer(game);
  const price  = lowestOffer?.priceToman ?? null;
  const stores = storeCount(game);
  const d      = game.details;
  const psStoreInfo: PsStoreInfo = storeInfo ?? {
    hasData: false,
    conceptId: null,
    us: { productId: null, storeUrl: null, current: null, original: null, discount: null },
    tr: { productId: null, storeUrl: null, current: null, original: null, discount: null },
  };
  // Screenshots are landscape S3 images — much better quality for a wide hero
  // than the portrait cover. For IGDB cover fallbacks swap the tiny size token
  // with t_1080p (1920×1080) so the blowup is at least at native resolution.
  const highResCover = game.coverUrl?.replace("t_cover_big", "t_1080p") ?? game.coverUrl ?? null;
  const heroBg = game.mainBackgroundImageUrl ?? game.screenshots[0] ?? highResCover;
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
    image: game.coverUrl ?? game.mainBackgroundImageUrl ?? undefined,
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

  // Breadcrumb: home / genre category (if one of the curated genres matches) / game title
  const category = genreForGame(game.genres);
  const faqs = gamePurchaseFaqs(game.title);
  const breadcrumbItems = [
    { label: "بازی‌های PS5", href: "/" },
    ...(category ? [{ label: category.label, href: `/genres/${category.slug}` }] : []),
    { label: game.title },
  ];
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: item.href ? `${SITE_URL}${item.href}` : `${SITE_URL}/games/${slug}`,
    })),
  };

  const facts: { label: string; value: string }[] = [
    { label: "ناشر",         value: game.publisher ?? "—" },
    ...(d?.developers?.length
      ? [{ label: "سازنده",   value: d.developers.join("، ") }] : []),
    ...(persianReleaseDate
      ? [{ label: "تاریخ انتشار", value: persianReleaseDate }]
      : [{ label: "سال انتشار", value: game.releaseYear ? toPersianDigits(game.releaseYear) : "—" }]),
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
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqPageJsonLd(faqs)} />
      <GamePageScrollReset slug={game.slug} />
      <GameViewTracker slug={game.slug} />
      <Header />
      <main className="flex-1">

        {/* ── Hero section — exactly one viewport tall ── */}
        <div className="relative min-h-[calc(100dvh-60px)] overflow-visible md:h-[calc(100dvh-60px)] md:overflow-hidden">

          {/* Background image — main background image preferred, cover as fallback */}
          {hasArt && (
            <Image
              src={heroBg!}
              alt=""
              aria-hidden="true"
              priority
              fill
              sizes="100vw"
              className="object-cover object-center"
            />
          )}

          {/* Dark gradient overlay — ensures ≥4.5:1 contrast for white text */}
          {hasArt && (
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/45 to-black/70" />
          )}

          {/* Content — fills full hero height, centers grid vertically */}
          <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 h-full flex flex-col py-6">
            <div className="shrink-0">
              <Breadcrumb items={breadcrumbItems} light={hasArt} />
            </div>

            {/* Hero grid — cover LEFT (RTL), info RIGHT — both top-aligned */}
            <div className="flex-1 mt-4 grid grid-cols-1 gap-8 md:grid-cols-[1fr_minmax(0,32%)] items-start">

              {/* ── Info column (RIGHT in RTL) ── */}
              <div className="flex flex-col gap-0">

                {/* Chips + wishlist */}
                <div className="flex flex-wrap items-center gap-2">
                  <Chip size="sm" className="bg-ps-blue text-white border-0 font-bold">PS5</Chip>
                  {game.genres.map((genre) => (
                    <Chip
                      key={genre}
                      variant="soft"
                      color="default"
                      size="sm"
                      className={hasArt ? "bg-white/15 text-white border-white/20" : ""}
                    >
                      {genre}
                    </Chip>
                  ))}
                  <div className="mr-auto">
                    <WishlistButton gameId={game.dbId} />
                  </div>
                </div>

                {/* Title + price card — same row, top-aligned */}
                <div className="mt-3 flex flex-col items-stretch gap-4 sm:flex-row sm:items-start">
                  <h1 dir="auto" className={`flex-1 text-right text-3xl font-extrabold leading-tight sm:text-4xl ${
                    hasArt ? "text-white" : ""
                  }`}>
                    {game.title}
                  </h1>

                  {price !== null && (
                    <div className={`w-full rounded-2xl px-4 py-3 text-start sm:w-auto sm:shrink-0 ${
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
                        {lowestOffer ? `به شکل ${lowestOffer.purchaseLabel}` : `در ${toPersianDigits(stores)} فروشگاه`}
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
                <PsStorePriceBadges info={psStoreInfo} />
                {storeInfoUnavailable && (
                  <InlineDegradedNotice>
                    قیمت رسمی PlayStation Store موقتاً در دسترس نیست؛ قیمت فروشندگان داخلی همچنان قابل مقایسه است.
                  </InlineDegradedNotice>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pre-order countdown — only renders when release date is in the future */}
        {game.releaseDate && (
          <GamePreorderBanner
            releaseDate={game.releaseDate}
            mainBackgroundImageUrl={game.mainBackgroundImageUrl}
            title={game.title}
          />
        )}

        {/* Screenshot gallery */}
        <ScreenshotGallery screenshots={game.screenshots} />

        <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
          <PurchaseTypeSelector options={game.purchaseOptions} />
        </div>

        <GameVersions games={gameVersions} />
        {gameVersionsUnavailable && (
          <DegradedNotice>
            نمایش نسخه‌های دیگر این بازی موقتاً در دسترس نیست.
          </DegradedNotice>
        )}
        <SimilarGames games={similarGames} heading="بازی‌های مشابه" tags={game.genres} />
        {similarGamesUnavailable && (
          <DegradedNotice>
            پیشنهادهای مشابه بر اساس سبک بازی موقتاً در دسترس نیست.
          </DegradedNotice>
        )}
        <SimilarGames games={similarGamesByDeveloper} heading="بازی‌های همین سازنده" tags={game.developers} />
        {similarGamesByDeveloperUnavailable && (
          <DegradedNotice>
            پیشنهادهای مربوط به سازنده این بازی موقتاً در دسترس نیست.
          </DegradedNotice>
        )}
        <GameReviewsSection gameId={game.dbId} gameTitle={game.title} description={game.description} />
        <FaqSection faqs={faqs} />
      </main>
      <Disclaimer />
    </>
  );
}
