import type { Metadata } from "next";
import TrustPage, { trustPageMetadata } from "@/components/TrustPage";
import { trustPageBySlug } from "@/lib/trust-pages";

const page = trustPageBySlug("about");

export const metadata: Metadata = trustPageMetadata(page);

export const dynamic = "force-dynamic";

export default function AboutPage() {
  return <TrustPage page={page} />;
}
