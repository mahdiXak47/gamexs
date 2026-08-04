import type { Metadata } from "next";
import { publisherLandingMetadata, renderPublisherLandingPage } from "@/components/PublisherLandingPage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { slug } = await params;
  return publisherLandingMetadata({ slug, searchParams });
}

export default async function PublisherPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  return renderPublisherLandingPage({ slug, searchParams });
}
