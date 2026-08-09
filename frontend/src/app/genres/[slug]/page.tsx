import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Chip } from "@heroui/react";
import Breadcrumb from "@/components/Breadcrumb";
import Header from "@/components/Header";
import GameGrid from "@/components/GameGrid";
import Disclaimer from "@/components/Disclaimer";
import HeroBanner from "@/components/HeroBanner";
import JsonLd from "@/components/JsonLd";
import { listGamesPage, listPublishers } from "@/lib/games-repo";
import { genreBySlug, GENRES } from "@/lib/genres";
import { toPersianDigits } from "@/lib/format";
import { parseGameListSearchParams } from "@/lib/search-params";
import { breadcrumbJsonLd, shouldNoIndexCatalogParams, SITE_URL } from "@/lib/seo";

const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return GENRES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { slug } = await params;
  const genre = genreBySlug(slug);
  if (!genre) return {};
  const parsed = parseGameListSearchParams(await searchParams);
  const shouldNoIndex = shouldNoIndexCatalogParams(parsed);

  const title = `${genre.label} برای PS5 — قیمت و مقایسه`;
  const description = `مقایسه قیمت ${genre.label} برای PS5 بین فروشندگان معتبر ایرانی — اکانت، دیسک و اشتراک`;

  return {
    title,
    description,
    alternates: { canonical: `/genres/${slug}` },
    openGraph: { title, description, url: `${SITE_URL}/genres/${slug}` },
    ...(shouldNoIndex && {
      robots: {
        index: false,
        follow: true,
      },
    }),
  };
}

export default async function GenrePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const genre = genreBySlug(slug);
  if (!genre) notFound();

  const { query, sort, publishers, page } = parseGameListSearchParams(await searchParams);

  const [{ games, total }, publishersList] = await Promise.all([
    listGamesPage({ genre: genre.genre, query, sort, publishers, page, pageSize: PAGE_SIZE }),
    listPublishers(genre.genre),
  ]);

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
  const breadcrumbItems = [
    { label: "بازی‌های PS5", href: "/" },
    { label: genre.label },
  ];
  const breadcrumbSchema = breadcrumbJsonLd([
    { name: "بازی‌های PS5", path: "/" },
    { name: genre.label, path: `/genres/${slug}` },
  ]);

  return (
    <>
      {games.length > 0 && <JsonLd data={itemListJsonLd} />}
      <JsonLd data={breadcrumbSchema} />
      <Header />

      <HeroBanner
        games={games.slice(0, 5)}
        copy={{
          ariaLabel: `بازی‌های ویژه ${genre.label}`,
          badge: genre.label,
          cta: "مشاهده قیمت‌ها",
        }}
      />

      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6">
          <div className="mb-4">
            <Breadcrumb items={breadcrumbItems} />
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
              {genre.label}
            </h1>
            {total > 0 && (
              <Chip variant="soft" color="default" size="sm">
                {toPersianDigits(total)} بازی
              </Chip>
            )}
          </div>
        </div>

        {total === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300" aria-hidden>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <p className="text-gray-500 font-medium">بازی‌ای در این دسته یافت نشد</p>
          </div>
        ) : (
          <GameGrid
            games={games}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            sort={sort}
            query={query}
            selectedPublishers={publishers}
            publishersList={publishersList}
            basePath={`/genres/${slug}`}
          />
        )}
      </main>

      <Disclaimer />
    </>
  );
}
