import Link from "next/link";
import { Chip } from "@heroui/react";
import CoverArt from "./CoverArt";
import { formatToman, toPersianDigits } from "@/lib/format";
import type { GameSummary } from "@/lib/types";

export default function GameCard({ game, isBestPrice = false }: { game: GameSummary; isBestPrice?: boolean }) {
  return (
    <Link href={`/games/${game.slug}`} className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue focus-visible:ring-offset-2">
      <div className="game-card-3d h-full rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-black/5 flex flex-col">
        {/* Cover */}
        <div className="relative">
          <CoverArt coverUrl={game.coverUrl} title={game.title} initial={game.coverInitial} className="aspect-[3/4]" />
          <Chip
            size="sm"
            className="absolute right-2 top-2 bg-ps-blue text-white border-0 text-[10px] font-bold"
          >
            PS5
          </Chip>
          {game.genreLabel && (
            <span className="absolute left-2 top-2 rounded-full bg-blue-50/95 px-2 py-0.5 text-[10px] font-medium text-ps-blue shadow-sm backdrop-blur-sm">
              {game.genreLabel}
            </span>
          )}
          {isBestPrice && (
            <Chip
              size="sm"
              className="absolute left-2 top-8 bg-green-500 text-white border-0 text-[10px] font-bold"
            >
              بهترین قیمت
            </Chip>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-1 p-2.5 flex-1">
          <p dir="auto" className="line-clamp-2 text-center text-sm font-bold text-gray-900 leading-snug">{game.title}</p>
          <div className="mt-auto pt-1.5">
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] text-gray-400">از</span>
              <span className="price-figure text-base font-extrabold text-gray-900">
                {game.lowestPriceToman === null ? "—" : formatToman(game.lowestPriceToman)}
              </span>
              <span className="text-[10px] text-gray-400">تومان</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {game.lowestPriceLabel && game.lowestPriceToman !== null
                ? `به شکل ${game.lowestPriceLabel} · `
                : ""}
              {toPersianDigits(game.storeCount)} فروشگاه · {toPersianDigits(game.purchaseTypeCount)} نوع
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
