import Image from "next/image";
import Link from "next/link";
import { toPersianDigits } from "@/lib/format";
import type { GameSummary } from "@/lib/types";
import TopGameActions from "./TopGameActions";

function TopGameCard({ game, rank }: { game: GameSummary; rank: number }) {
  return (
    <article className="group min-w-[145px] max-w-[178px] flex-1 snap-start" dir="rtl">
      <div className="relative aspect-[2/3] overflow-hidden rounded-[13px] border border-white/10 bg-ps-night shadow-[0_12px_28px_rgba(0,0,0,0.3)]">
        <Link
          href={`/games/${game.slug}`}
          className="absolute inset-0 z-0 rounded-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-plus-gold focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg"
          aria-label={`مشاهده ${game.title}`}
        >
          {game.coverUrl ? (
            <Image
              src={game.coverUrl}
              alt={game.title}
              fill
              sizes="(max-width: 640px) 145px, (max-width: 1280px) 16vw, 178px"
              className="object-cover transition duration-300 ease-out group-hover:scale-[1.045]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-ps-blue to-ps-night text-3xl font-black text-white/45">
              {game.coverInitial}
            </div>
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/20 opacity-75 transition-opacity duration-200 group-hover:opacity-100" />
        </Link>

        <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-center justify-between gap-2 text-[10px] font-black">
          <span className="rounded-full bg-black/65 px-2 py-1 text-white/90 backdrop-blur-sm">
            #{toPersianDigits(rank)}
          </span>
          <span className="rounded-full bg-ps-plus-gold px-2.5 py-1 text-gray-950 shadow-sm">
            PS5
          </span>
        </div>

        {game.dbId != null && <TopGameActions gameId={game.dbId} />}
      </div>

      <Link
        href={`/games/${game.slug}`}
        className="mt-2 block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-plus-gold focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg"
      >
        <p dir="auto" className="truncate text-sm font-extrabold text-gray-900">
          {game.title}
        </p>
        <p className="mt-1 truncate text-[11px] font-medium text-gray-500">
          {game.genreLabel ?? "بازی PS5"}
          {game.releaseYear ? ` · ${toPersianDigits(game.releaseYear)}` : ""}
        </p>
      </Link>
    </article>
  );
}

export default function TopGames({
  games,
  heading = "محبوب‌ترین بازی‌ها",
  headingId = "top-games-heading",
  viewAllHref = "/?sort=popular",
}: {
  games: GameSummary[];
  heading?: string;
  headingId?: string;
  viewAllHref?: string;
}) {
  if (games.length === 0) return null;

  return (
    <section className="overflow-hidden bg-page-bg py-7 text-gray-900 sm:py-8" aria-labelledby={headingId} dir="rtl">
      <div className="mx-auto max-w-[1840px] px-4 sm:px-6 2xl:px-8">
        <div className="mb-5 flex items-center gap-3">
          <span className="h-5 w-1 rounded-full bg-ps-plus-gold" aria-hidden />
          <h2 id={headingId} className="text-xl font-extrabold tracking-tight text-gray-900 sm:text-2xl">
            {heading}
          </h2>
          <div className="h-px flex-1 bg-ps-blue/15" aria-hidden />
          <Link
            href={viewAllHref}
            className="shrink-0 rounded-md text-sm font-bold text-ps-blue transition-colors hover:text-ps-blue-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg"
          >
            مشاهده همه
          </Link>
        </div>

        <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory lg:gap-4" dir="ltr">
          {games.slice(0, 10).map((game, index) => (
            <TopGameCard key={game.slug} game={game} rank={index + 1} />
          ))}
        </div>
      </div>
    </section>
  );
}
