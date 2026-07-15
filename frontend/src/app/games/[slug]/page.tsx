import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip } from "@heroui/react";
import CoverArt from "@/components/CoverArt";
import Disclaimer from "@/components/Disclaimer";
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

  const price = lowestPrice(game);
  const stores = storeCount(game);
  const d = game.details;

  // All quick-fact cells — label + text value, uniform style
  const facts: { label: string; value: string }[] = [
    { label: "ناشر",       value: game.publisher ?? "—" },
    { label: "سال انتشار", value: game.releaseYear ? toPersianDigits(game.releaseYear) : "—" },
    ...(d?.developers?.length   ? [{ label: "سازنده",   value: d.developers.join("، ") }]   : []),
    ...(d?.genres?.length       ? [{ label: "ژانر",     value: d.genres.join("، ") }]        : []),
    ...(d?.themes?.length       ? [{ label: "تم",       value: d.themes.join("، ") }]        : []),
    ...((d?.gameModes?.length || d?.playerPerspectives?.length)
      ? [{ label: "سبک بازی", value: [...(d?.gameModes ?? []), ...(d?.playerPerspectives ?? [])].join("، ") }]
      : []),
    ...(d?.franchises?.length   ? [{ label: "فرانچایز", value: d.franchises.join("، ") }]   : []),
  ];

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
          >
            ← بازگشت به فهرست بازی‌ها
          </Link>

          {/* Hero: cover (left in RTL, second child) | content (right, first child) */}
          <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-[1fr_260px]">

            {/* ── Content column ── */}
            <div className="flex flex-col gap-0">

              {/* Platform + genre chips */}
              <div className="flex flex-wrap items-center gap-2">
                <Chip size="sm" className="bg-ps-blue text-white border-0 font-bold">PS5</Chip>
                {game.genreLabel && (
                  <Chip variant="soft" color="default" size="sm">{game.genreLabel}</Chip>
                )}
              </div>

              {/* Title + price inline */}
              <div className="mt-3 flex items-start gap-4">
                <h1 className="flex-1 text-3xl font-extrabold leading-tight sm:text-4xl">
                  {game.title}
                </h1>

                {price !== null && (
                  <div className="shrink-0 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-start">
                    <p className="text-xs font-medium text-success">کمترین قیمت</p>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="price-figure text-lg font-extrabold leading-none">
                        {formatToman(price)}
                      </span>
                      <span className="text-xs text-muted">تومان</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      در {toPersianDigits(stores)} فروشگاه
                    </p>
                  </div>
                )}
              </div>

              {/* Quick facts — uniform label + value grid */}
              <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                {facts.map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-muted">{label}</p>
                    <p className="mt-0.5 text-sm font-semibold leading-snug">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Cover — left column in RTL (second child → right-to-left order) ── */}
            <CoverArt
              coverUrl={game.coverUrl}
              title={game.title}
              initial={game.coverInitial}
              className="aspect-[3/4] rounded-2xl"
              priority
            />
          </div>
        </div>

        {/* Screenshot gallery — full viewport width */}
        <ScreenshotGallery screenshots={game.screenshots} />

        <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
          <PurchaseTypeSelector options={game.purchaseOptions} />
        </div>
      </main>
      <Disclaimer />
    </>
  );
}
