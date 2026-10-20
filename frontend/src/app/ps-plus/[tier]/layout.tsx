import { notFound } from "next/navigation";
import { SLUG_TIER, getPsPlusPlan } from "@/lib/ps-plus-repo";

// Unknown tier → real 404 before the segment's loading.tsx streams a 200.
export default async function PsPlusTierLayout({ children, params }: { children: React.ReactNode; params: Promise<{ tier: string }> }) {
  const tierKey = SLUG_TIER[(await params).tier];
  if (!tierKey || !(await getPsPlusPlan(tierKey))) notFound();
  return children;
}
