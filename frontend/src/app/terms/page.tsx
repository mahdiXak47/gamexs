import type { Metadata } from "next";
import TrustPage, { trustPageMetadata } from "@/components/TrustPage";
import { trustPageBySlug } from "@/lib/trust-pages";

const page = trustPageBySlug("terms");

export const metadata: Metadata = trustPageMetadata(page);

export default function TermsPage() {
  return <TrustPage page={page} />;
}
