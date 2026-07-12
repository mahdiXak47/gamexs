import Link from "next/link";
import { Card, Chip } from "@heroui/react";
import CoverArt from "./CoverArt";
import { formatToman, toPersianDigits } from "@/lib/format";
import type { GameSummary } from "@/lib/types";

export default function GameCard({ game, isBestPrice = false }: { game: GameSummary; isBestPrice?: boolean }) {
  return (
    <Link href={`/games/${game.slug}`} className="group block h-full">
      <Card className="h-full gap-0 overflow-hidden p-0 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:group-hover:-translate-y-1">
        <div className="relative">
          <CoverArt coverUrl={game.coverUrl} title={game.title} initial={game.coverInitial} className="aspect-[3/4]" />
          <Chip variant="primary" color="accent" size="sm" className="absolute right-3 top-3">
            PS5
          </Chip>
          {isBestPrice && (
            <Chip variant="primary" color="success" size="sm" className="absolute left-3 top-3">
              بهترین قیمت
            </Chip>
          )}
        </div>
        <Card.Content className="flex flex-col gap-2 p-4">
          <p className="line-clamp-2 text-sm font-bold text-foreground">{game.title}</p>
          {game.genreLabel && (
            <Chip variant="soft" color="default" size="sm">{game.genreLabel}</Chip>
          )}
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xs text-muted">از</span>
            <span className="price-figure text-lg font-extrabold text-foreground">
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
