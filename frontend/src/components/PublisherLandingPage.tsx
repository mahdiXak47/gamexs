import { notFound } from "next/navigation";
import { Chip } from "@heroui/react";
import Breadcrumb from "@/components/Breadcrumb";
import Disclaimer from "@/components/Disclaimer";
import GameGrid from "@/components/GameGrid";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import { getPublisherBySlug, listGamesPage } from "@/lib/games-repo";
import { toPersianDigits } from "@/lib/format";
import { parseGameListSearchParams } from "@/lib/search-params";
import { breadcrumbJsonLd, shouldNoIndexCatalogParams, SITE_URL } from "@/lib/seo";

const PAGE_SIZE = 20;

export async function renderPublisherLandingPage({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const publisher = await getPublisherBySlug(slug);
  if (!publisher) notFound();

  const { query, sort, page } = parseGameListSearchParams(await searchParams);
  const { games, total } = await listGamesPage({
    publishers: [publisher],
    query,
    sort,
    page,
    pageSize: PAGE_SIZE,
    onlyWithListings: true,
  });

  const title = `بازی‌های ${publisher} برای PS5`;
  const description = `مقایسه قیمت بازی‌های ${publisher} برای PS5 بین فروشندگان ایرانی.`;

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: `${SITE_URL}/publishers/${slug}`,
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
    { label: publisher },
  ];
  const breadcrumbSchema = breadcrumbJsonLd([
    { name: "بازی‌های PS5", path: "/" },
    { name: publisher, path: `/publishers/${slug}` },
  ]);

  return (
    <>
      <JsonLd data={collectionJsonLd} />
      <JsonLd data={breadcrumbSchema} />
      <Header />
      <div className="ps-header">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-5">
            <Breadcrumb items={breadcrumbItems} light />
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 dir="auto" className="text-right text-2xl font-extrabold text-white sm:text-3xl">
              {title}
            </h1>
            <Chip variant="soft" size="sm" className="bg-white/20 text-white">
              {toPersianDigits(total)} بازی
            </Chip>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-white/70">
            {description}
          </p>
        </div>
      </div>
      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <GameGrid
          games={games}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          sort={sort}
          query={query}
          selectedPublishers={[]}
          publishersList={[]}
          basePath={`/publishers/${slug}`}
        />
      </main>
      <Disclaimer />
    </>
  );
}

export async function publisherLandingMetadata({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const publisher = await getPublisherBySlug(slug);
  if (!publisher) return {};

  const parsed = parseGameListSearchParams(await searchParams);
  const shouldNoIndex = shouldNoIndexCatalogParams(parsed);
  const title = `بازی‌های ${publisher} برای PS5 — قیمت و مقایسه`;
  const description = `مقایسه قیمت بازی‌های ${publisher} برای PS5 بین فروشندگان ایرانی.`;

  return {
    title,
    description,
    alternates: { canonical: `/publishers/${slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/publishers/${slug}`,
    },
    ...(shouldNoIndex && {
      robots: {
        index: false,
        follow: true,
      },
    }),
  };
}
