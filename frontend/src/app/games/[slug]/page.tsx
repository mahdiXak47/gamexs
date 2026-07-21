import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip } from "@heroui/react";
import CoverArt from "@/components/CoverArt";
import Disclaimer from "@/components/Disclaimer";
import GamePreorderBanner from "@/components/GamePreorderBanner";
import Header from "@/components/Header";
import PurchaseTypeSelector from "@/components/PurchaseTypeSelector";
import ScreenshotGallery from "@/components/ScreenshotGallery";
import { formatToman, toPersianDigits } from "@/lib/format";
import { getGameBySlug } from "@/lib/games-repo";
import { lowestPrice, storeCount } from "@/lib/purchase-options";

export const dynamic = "force-dynamic";

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const price  = lowestPrice(game);
  const stores = storeCount(game);
  const d      = game.details;
  const heroBg = game.keyArtUrl ?? game.coverUrl;
  const hasArt = !!heroBg;

  const facts: { label: string; value: string }[] = [
    { label: "ناشر",       value: game.publisher ?? "—" },
    { label: "سال انتشار", value: game.releaseYear ? toPersianDigits(game.releaseYear) : "—" },
    ...(d?.developers?.length
      ? [{ label: "سازنده",   value: d.developers.join("، ") }] : []),
    ...(d?.genres?.length
      ? [{ label: "ژانر",     value: d.genres.join("، ") }] : []),
    ...(d?.themes?.length
      ? [{ label: "تم",       value: d.themes.join("، ") }] : []),
    ...((d?.gameModes?.length || d?.playerPerspectives?.length)
      ? [{ label: "سبک بازی", value: [...(d?.gameModes ?? []), ...(d?.playerPerspectives ?? [])].join("، ") }]
      : []),
    ...(d?.franchises?.length
      ? [{ label: "فرانچایز", value: d.franchises.join("، ") }] : []),
  ];

  return (
    <>
      <Header />
      <main className="flex-1">

        {/* ── Hero section — key art background when available ── */}
        <div className="relative overflow-hidden">

          {/* Background image — key art preferred, cover as fallback */}
          {hasArt && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={heroBg!}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover object-center scale-105 blur-[2px]"
            />
          )}

          {/* Dark gradient overlay — ensures ≥4.5:1 contrast for white text */}
          {hasArt && (
            <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/65 to-black/80" />
          )}

          {/* Content */}
          <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <Link
              href="/"
              className={`inline-flex items-center gap-2 text-sm transition-colors ${
                hasArt
                  ? "text-white/65 hover:text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              ← بازگشت به فهرست بازی‌ها
            </Link>

            {/* Hero grid: content | cover */}
            <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-[1fr_260px]">

              {/* ── Content column ── */}
              <div className="flex flex-col gap-0">

                {/* Chips */}
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
                </div>

                {/* Title + price card */}
                <div className="mt-3 flex items-start gap-4">
                  <h1 className={`flex-1 text-3xl font-extrabold leading-tight sm:text-4xl ${
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

                {/* Quick facts */}
                <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                  {facts.map(({ label, value }) => (
                    <div key={label}>
                      <p className={`text-xs ${hasArt ? "text-white/55" : "text-muted"}`}>{label}</p>
                      <p className={`mt-0.5 text-sm font-semibold leading-snug ${
                        hasArt ? "text-white" : ""
                      }`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Cover art ── */}
              <CoverArt
                coverUrl={game.coverUrl}
                title={game.title}
                initial={game.coverInitial}
                className="aspect-[3/4] rounded-2xl shadow-2xl"
                priority
              />
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
