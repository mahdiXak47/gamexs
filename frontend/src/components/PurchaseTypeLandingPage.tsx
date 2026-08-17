import { Chip } from "@heroui/react";
import Breadcrumb from "@/components/Breadcrumb";
import Disclaimer from "@/components/Disclaimer";
import GameGrid from "@/components/GameGrid";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import { listGamesPage } from "@/lib/games-repo";
import { parseGameListSearchParams } from "@/lib/search-params";
import { breadcrumbJsonLd, shouldNoIndexCatalogParams, SITE_URL } from "@/lib/seo";
import type { PurchaseTypePageDefinition } from "@/lib/purchase-type-pages";

const PAGE_SIZE = 20;

export async function renderPurchaseTypeLandingPage({
  definition,
  searchParams,
}: {
  definition: PurchaseTypePageDefinition;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { query, sort, publishers, page } = parseGameListSearchParams(await searchParams);
  const { games, total } = await listGamesPage({
    productType: definition.productType,
    tier: definition.tier,
    query,
    sort,
    publishers,
    page,
    pageSize: PAGE_SIZE,
    onlyWithListings: true,
  });

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: definition.h1,
    description: definition.description,
    url: `${SITE_URL}${definition.path}`,
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
    { label: definition.h1 },
  ];
  const breadcrumbSchema = breadcrumbJsonLd([
    { name: "بازی‌های PS5", path: "/" },
    { name: definition.h1, path: definition.path },
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
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
              {definition.h1}
            </h1>
            <Chip variant="soft" size="sm" className="bg-white/20 text-white">
              PS5
            </Chip>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-white/70">
            {definition.description}
          </p>
        </div>
      </div>
      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <GameGrid
          games={games}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          sort={sort}
          query={query}
          selectedPublishers={publishers}
          publishersList={[]}
          basePath={definition.path}
          emptyTitle={`فعلاً بازی‌ای برای ${definition.h1} پیدا نشد.`}
          emptyDescription="عنوان را ساده‌تر جستجو کنید یا بعد از به‌روزرسانی قیمت فروشندگان دوباره این بخش را بررسی کنید."
        />
      </main>
      <Disclaimer />
    </>
  );
}

export async function purchaseTypeLandingMetadata({
  definition,
  searchParams,
}: {
  definition: PurchaseTypePageDefinition;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = parseGameListSearchParams(await searchParams);
  const shouldNoIndex = shouldNoIndexCatalogParams(parsed);

  return {
    title: definition.title,
    description: definition.description,
    alternates: { canonical: definition.path },
    openGraph: {
      title: definition.title,
      description: definition.description,
      url: `${SITE_URL}${definition.path}`,
    },
    ...(shouldNoIndex && {
      robots: {
        index: false,
        follow: true,
      },
    }),
  };
}
