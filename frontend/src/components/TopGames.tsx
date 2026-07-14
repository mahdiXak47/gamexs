import Link from "next/link";
import Image from "next/image";
import { formatToman } from "@/lib/format";
import type { GameSummary } from "@/lib/types";

function TrendingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

export default function TopGames({ games }: { games: GameSummary[] }) {
  if (games.length === 0) return null;

  return (
    <section className="py-10 px-4 sm:px-6" aria-labelledby="top-games-heading">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-2 text-ps-blue">
            <TrendingIcon />
          </div>
          <h2 id="top-games-heading" className="text-xl font-extrabold text-gray-900">
            محبوب‌ترین بازی‌ها
          </h2>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-ps-blue/20" />
          <Link href="/" className="text-sm text-ps-blue font-medium hover:underline shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue rounded">
            مشاهده همه
          </Link>
        </div>

        {/* Horizontal scroll on mobile, wrap on desktop */}
        <div className="hide-scrollbar flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory md:grid md:grid-cols-5 md:overflow-visible md:pb-0">
          {games.slice(0, 10).map((game, index) => (
            <Link
              key={game.slug}
              href={`/games/${game.slug}`}
              className="group relative shrink-0 w-36 md:w-auto snap-start rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue focus-visible:ring-offset-2"
            >
              <div className="game-card-3d relative rounded-xl overflow-hidden bg-white shadow-md ring-1 ring-black/5">
                {/* Rank number */}
                <div className="absolute top-1 right-2 z-10">
                  <span className="rank-number" aria-label={`رتبه ${index + 1}`} style={{ fontSize: '3.5rem' }}>
                    {index + 1}
                  </span>
                </div>

                {/* Cover */}
                <div className="relative aspect-[3/4] bg-gray-100">
                  {game.coverUrl ? (
                    <Image
                      src={game.coverUrl}
                      alt={game.title}
                      fill
                      className="object-cover"
                      loading="lazy"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400">
                      {game.coverInitial}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-2.5">
                  <p className="text-xs font-bold text-gray-900 line-clamp-2 leading-snug mb-1">{game.title}</p>
                  {game.lowestPriceToman !== null ? (
                    <p className="price-figure text-xs font-extrabold text-ps-blue">
                      {formatToman(game.lowestPriceToman)}
                      <span className="font-normal text-gray-400 text-[10px] mr-0.5">ت</span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">—</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
