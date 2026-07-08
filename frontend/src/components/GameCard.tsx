import Link from "next/link";
import { Card, Chip } from "@heroui/react";
import CoverArt from "./CoverArt";
import { formatToman, toPersianDigits } from "@/lib/format";
import type { GameSummary } from "@/lib/types";

export default function GameCard({ game }: { game: GameSummary }) {
  return (
    <Link href={`/games/${game.slug}`} className="group block h-full">
      <Card className="h-full gap-0 overflow-hidden p-0 transition-transform group-hover:-translate-y-1">
        <div className="relative">
          <CoverArt coverUrl={game.coverUrl} initial={game.coverInitial} className="aspect-[4/3]" />
          <Chip variant="primary" color="accent" size="sm" className="absolute right-3 top-3">
            PS5
          </Chip>
        </div>
        <Card.Content className="flex flex-col gap-2 p-4">
          <p className="text-sm font-bold text-foreground">{game.title}</p>
          {game.genreLabel && <p className="text-xs text-muted">{game.genreLabel}</p>}
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xs text-muted">از</span>
            <span className="text-lg font-extrabold text-foreground">
              {game.lowestPriceToman === null ? "—" : formatToman(game.lowestPriceToman)}
            </span>
            <span className="text-xs text-muted">تومان</span>
          </div>
          <p className="text-xs text-muted">
            {toPersianDigits(game.storeCount)} فروشگاه · {toPersianDigits(game.purchaseTypeCount)} نوع خرید
          </p>
        </Card.Content>
      </Card>
    </Link>
  );
}
