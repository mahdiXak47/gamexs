import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Chip } from "@heroui/react";
import Header from "@/components/Header";
import GameGrid from "@/components/GameGrid";
import Disclaimer from "@/components/Disclaimer";
import JsonLd from "@/components/JsonLd";
import { getGamesByGenre } from "@/lib/games-repo";
import { genreBySlug, GENRES } from "@/lib/genres";
import { toPersianDigits } from "@/lib/format";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return GENRES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const genre = genreBySlug(slug);
  if (!genre) return {};

  const title = `${genre.label} برای PS5 — قیمت و مقایسه`;
  const description = `مقایسه قیمت ${genre.label} برای PS5 بین فروشندگان معتبر ایرانی — اکانت، دیسک و اشتراک`;

  return {
    title,
    description,
    alternates: { canonical: `/genres/${slug}` },
    openGraph: { title, description, url: `${SITE_URL}/genres/${slug}` },
  };
}

export default async function GenrePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const genre = genreBySlug(slug);
  if (!genre) notFound();

  const games = await getGamesByGenre(genre.genre);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `بازی‌های ${genre.label}`,
    url: `${SITE_URL}/genres/${slug}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: games.map((game, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}/games/${game.slug}`,
        name: game.title,
      })),
    },
  };

  return (
    <>
      {games.length > 0 && <JsonLd data={itemListJsonLd} />}
      <Header />

      {/* Blue header band */}
      <div className="ps-header">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
              {genre.label}
            </h1>
            {games.length > 0 && (
              <Chip
                variant="soft"
                size="sm"
                className="bg-white/20 text-white"
              >
                {toPersianDigits(games.length)} بازی
              </Chip>
            )}
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors"
            dir="rtl"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 18 6-6-6-6" />
            </svg>
            همه بازی‌ها
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {games.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300" aria-hidden>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <p className="text-gray-500 font-medium">بازی‌ای در این دسته یافت نشد</p>
          </div>
        ) : (
          <GameGrid games={games} />
        )}
      </main>

      <Disclaimer />
    </>
  );
}
