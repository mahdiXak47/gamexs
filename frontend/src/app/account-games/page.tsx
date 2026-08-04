import type { Metadata } from "next";
import { purchaseTypeLandingMetadata, renderPurchaseTypeLandingPage } from "@/components/PurchaseTypeLandingPage";
import { purchaseTypePageBySlug } from "@/lib/purchase-type-pages";

export const dynamic = "force-dynamic";

const definition = purchaseTypePageBySlug("account-games")!;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  return purchaseTypeLandingMetadata({ definition, searchParams });
}

export default async function AccountGamesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderPurchaseTypeLandingPage({ definition, searchParams });
}
