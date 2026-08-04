import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import { breadcrumbJsonLd, SITE_NAME, SITE_URL } from "@/lib/seo";
import type { TrustPageDefinition } from "@/lib/trust-pages";

export function trustPageMetadata(page: TrustPageDefinition): Metadata {
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.path },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `${SITE_URL}${page.path}`,
      type: "website",
    },
  };
}

export default function TrustPage({ page }: { page: TrustPageDefinition }) {
  const breadcrumbItems = [
    { label: "GameXS", href: "/" },
    { label: page.h1 },
  ];
  const breadcrumbSchema = breadcrumbJsonLd([
    { name: SITE_NAME, path: "/" },
    { name: page.h1, path: page.path },
  ]);
  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.h1,
    description: page.description,
    url: `${SITE_URL}${page.path}`,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={pageJsonLd} />
      <Header />
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-10 sm:px-6" dir="rtl">
        <Breadcrumb items={breadcrumbItems} />
        <div className="mt-8">
          <p className="text-sm font-bold text-ps-blue">GameXS</p>
          <h1 className="mt-2 text-3xl font-black text-gray-900">{page.h1}</h1>
          <p className="mt-4 text-base leading-8 text-gray-600">{page.intro}</p>
        </div>

        <div className="mt-8 space-y-5">
          {page.sections.map((section) => (
            <section key={section.heading} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-extrabold text-gray-900">{section.heading}</h2>
              <div className="mt-3 space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-gray-600">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
