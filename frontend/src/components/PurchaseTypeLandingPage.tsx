import { Chip } from "@heroui/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import Disclaimer from "@/components/Disclaimer";
import GameGrid from "@/components/GameGrid";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import FaqSection from "@/components/FaqSection";
import { formatToman, toPersianDigits } from "@/lib/format";
import { listGamesPage, purchaseTypeStats } from "@/lib/games-repo";
import { parseGameListSearchParams } from "@/lib/search-params";
import { breadcrumbJsonLd, catalogCanonicalPath, faqPageJsonLd, shouldNoIndexCatalogParams, SITE_URL } from "@/lib/seo";
import { PURCHASE_TYPE_PAGES, type PurchaseTypePageDefinition } from "@/lib/purchase-type-pages";

const PAGE_SIZE = 20;

export async function renderPurchaseTypeLandingPage({
  definition,
  searchParams,
}: {
  definition: PurchaseTypePageDefinition;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = parseGameListSearchParams(await searchParams);
  const { query, sort, publishers, page } = parsed;
  const statsPromise = purchaseTypeStats(definition.productType, definition.tier ?? null);
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
  if (total === 0 && !shouldNoIndexCatalogParams(parsed)) notFound();
  const stats = await statsPromise;
  const siblings = PURCHASE_TYPE_PAGES.filter((p) => p.slug !== definition.slug);

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
          {definition.productType === "ACCOUNT_GAME" && (
            <p className="mt-3 text-xs leading-6 text-white/60">
              تفاوت ظرفیت‌ها را نمی‌دانید؟{" "}
              <Link href="/guide/ps5-capacity-accounts" className="font-bold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
                راهنمای انتخاب ظرفیت PS5
              </Link>
            </p>
          )}
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
      <section aria-labelledby="about-heading" className="mx-auto w-full max-w-6xl px-4 pb-2 pt-4 sm:px-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 id="about-heading" className="text-xl font-extrabold text-gray-900">
            دربارهٔ {definition.h1}
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "بازی", value: toPersianDigits(total) },
              { label: "فروشگاه", value: toPersianDigits(stats.stores) },
              { label: "ارزان‌ترین قیمت", value: stats.lowestPrice ? `${formatToman(stats.lowestPrice)} تومان` : "—" },
              { label: "آخرین به‌روزرسانی", value: stats.lastUpdated ? stats.lastUpdated.toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran", day: "numeric", month: "long" }) : "—" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-ps-blue-light/50 px-4 py-3">
                <dt className="text-xs text-gray-500">{item.label}</dt>
                <dd className="mt-1 text-sm font-bold text-ps-night">{item.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 space-y-3 text-sm leading-7 text-gray-700">
            {definition.intro.map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </div>
          <nav aria-label="روش‌های دیگر خرید" className="mt-5 border-t border-gray-100 pt-4">
            <p className="text-xs font-bold text-gray-500">روش‌های دیگر خرید بازی PS5</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {[...siblings.map((p) => ({ href: p.path, label: p.h1 })), { href: "/ps-plus", label: "اشتراک PS Plus" }, { href: "/guide/ps5-capacity-accounts", label: "راهنمای ظرفیت‌ها" }].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="inline-flex min-h-9 items-center rounded-full border border-gray-200 px-3 text-xs font-medium text-gray-700 transition-colors hover:border-ps-blue hover:text-ps-blue">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
      <FaqSection faqs={definition.faqs} />
      <JsonLd data={faqPageJsonLd(definition.faqs)} />
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
  const canonical = catalogCanonicalPath(definition.path, parsed);

  if (!shouldNoIndex) {
    const { total } = await listGamesPage({
      productType: definition.productType,
      tier: definition.tier,
      page: 1,
      pageSize: 1,
      onlyWithListings: true,
    });
    if (total === 0) notFound();
  }

  return {
    title: definition.title,
    description: definition.description,
    alternates: { canonical },
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
