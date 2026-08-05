import type { Metadata } from "next";
import TrustPage, { trustPageMetadata } from "@/components/TrustPage";
import { trustPageBySlug } from "@/lib/trust-pages";

const page = trustPageBySlug("contact");

export const metadata: Metadata = trustPageMetadata(page);

export const dynamic = "force-dynamic";

export default function ContactPage() {
  return <TrustPage page={page} />;
}
