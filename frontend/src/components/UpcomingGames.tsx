import Link from "next/link";
import Image from "next/image";
import type { UpcomingGame } from "@/lib/types";
import CountdownTimer from "./CountdownTimer";
import { formatToman, toPersianDigits } from "@/lib/format";

function formatPersianDate(isoDate: string): string {
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(isoDate));
}

function UpcomingCard({ game }: { game: UpcomingGame }) {
  const bg = game.keyArtUrl ?? game.coverUrl;

  return (
    <Link
      href={`/games/${game.slug}`}
      className="group relative overflow-hidden rounded-2xl min-h-[240px] sm:min-h-[280px] flex flex-col justify-between cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
      aria-label={`${game.title} — پیش‌خرید`}
    >
      {/* Background image */}
      {bg ? (
        <Image
          src={bg}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 50vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          aria-hidden
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
      )}

      {/* Gradient overlays — top for text, bottom for countdown */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/20 to-black/85 pointer-events-none" />

      {/* Top: title + date (RTL — text sticks to right) */}
      <div className="relative z-10 p-4 sm:p-5">
        <h3 className="text-lg sm:text-xl font-bold text-white leading-snug drop-shadow line-clamp-2">
          {game.title}
        </h3>
        <p className="text-sm text-white/80 mt-1 underline underline-offset-2 decoration-white/40">
          {formatPersianDate(game.releaseDate)}
        </p>
        {game.lowestPriceToman && (
          <p className="text-xs text-white/60 mt-1 price-figure">
            از {formatToman(game.lowestPriceToman)} تومان
          </p>
        )}
      </div>

      {/* Bottom: live countdown */}
      <div className="relative z-10 p-4 sm:p-5">
        <CountdownTimer releaseDate={game.releaseDate} />
      </div>
    </Link>
  );
}

export default function UpcomingGames({ games }: { games: UpcomingGame[] }) {
  if (!games.length) return null;

  return (
    <section aria-labelledby="upcoming-heading" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Section header — matches existing site style */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2
            id="upcoming-heading"
            className="text-xl font-extrabold uppercase tracking-wide text-gray-900 sm:text-2xl"
          >
            پرانتظارترین بازی‌ها
          </h2>
          <div className="mt-1 h-1 w-12 rounded-full bg-[#00d4aa]" />
        </div>
        <Link
          href="/upcoming"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-ps-blue)] px-4 py-2 text-sm font-semibold text-[var(--color-ps-blue)] transition-colors hover:bg-[var(--color-ps-blue)] hover:text-white"
        >
          مشاهده همه
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
      </div>

      {/* 2-column grid — 1 col on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {games.map((game) => (
          <UpcomingCard key={game.slug} game={game} />
        ))}
      </div>
    </section>
  );
}
