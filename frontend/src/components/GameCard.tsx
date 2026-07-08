import Link from "next/link";
import CoverArt from "./CoverArt";
import { formatToman, toPersianDigits } from "@/lib/format";
import type { GameSummary } from "@/lib/types";

export default function GameCard({ game, coverUrl }: { game: GameSummary; coverUrl?: string | null }) {
  return (
    <Link
      href={`/games/${game.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-transform hover:-translate-y-1 hover:border-accent"
    >
      <CoverArt coverUrl={coverUrl} initial={game.coverInitial} className="aspect-[4/3]">
        <span className="absolute right-3 top-3 rounded-md bg-accent px-2.5 py-1 text-[10px] font-bold text-white">
          PS5
        </span>
      </CoverArt>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-bold">{game.title}</h3>
        {game.genreLabel && <p className="text-sm text-muted">{game.genreLabel}</p>}

        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-xs text-muted">از</span>
          <span className="text-lg font-extrabold">
            {game.lowestPriceToman === null ? "—" : formatToman(game.lowestPriceToman)}
          </span>
          <span className="text-xs text-muted">تومان</span>
        </div>

        <p className="text-xs text-muted">
          {toPersianDigits(game.storeCount)} فروشگاه · {toPersianDigits(game.purchaseTypeCount)} نوع خرید
        </p>
      </div>
    </Link>
  );
}
