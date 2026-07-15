import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Chip } from "@heroui/react";
import CoverArt from "@/components/CoverArt";
import Disclaimer from "@/components/Disclaimer";
import Header from "@/components/Header";
import PurchaseTypeSelector from "@/components/PurchaseTypeSelector";
import ScreenshotGallery from "@/components/ScreenshotGallery";
import { formatToman, toPersianDigits } from "@/lib/format";
import { getGameBySlug } from "@/lib/games-repo";
import { lowestPrice, storeCount } from "@/lib/purchase-options";

// Always read fresh from the DB — see app/page.tsx for why.
export const dynamic = "force-dynamic";

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const price = lowestPrice(game);
  const stores = storeCount(game);

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
            ← بازگشت به فهرست بازی‌ها
          </Link>

          <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-[1fr_320px]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Chip variant="soft" color="accent" size="sm">PS5</Chip>
                {game.genreLabel && (
                  <Chip variant="soft" color="default" size="sm">{game.genreLabel}</Chip>
                )}
              </div>
              <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{game.title}</h1>

              <div className="mt-6 grid grid-cols-2 gap-6 sm:max-w-sm">
                <div>
                  <div className="text-xs text-muted">ناشر</div>
                  <div className="mt-1 font-bold">{game.publisher ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">سال انتشار</div>
                  <div className="mt-1 font-bold">
                    {game.releaseYear === null ? "—" : toPersianDigits(game.releaseYear)}
                  </div>
                </div>
              </div>

              <Card className="mt-6 max-w-sm border-success/30 bg-success/10">
                <Card.Content className="gap-1">
                  <div className="text-sm font-bold text-success">کمترین قیمت</div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="price-figure text-2xl font-extrabold">
                      {price === null ? "—" : formatToman(price)}
                    </span>
                    <span className="text-xs text-muted">تومان</span>
                  </div>
                  <div className="text-xs text-muted">در {toPersianDigits(stores)} فروشگاه</div>
                </Card.Content>
              </Card>
            </div>

            <CoverArt
              coverUrl={game.coverUrl}
              title={game.title}
              initial={game.coverInitial}
              className="aspect-[3/4] rounded-2xl md:order-last"
              priority
            />
          </div>
        </div>

        {/* Gallery outside the constrained container — naturally spans full viewport width */}
        <ScreenshotGallery screenshots={game.screenshots} />

        <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
          <PurchaseTypeSelector options={game.purchaseOptions} />
        </div>
      </main>
      <Disclaimer />
    </>
  );
}
