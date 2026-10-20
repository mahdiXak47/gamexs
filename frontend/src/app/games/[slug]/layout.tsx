import { notFound, permanentRedirect } from "next/navigation";
import { getGameBySlug } from "@/lib/games-repo";
import { storeCount } from "@/lib/purchase-options";

// Runs before this segment's loading.tsx streams, so a missing game is a real
// HTTP 404 and an old slug a real 308 — not a soft 404 / client-side redirect
// committed after a 200. getGameBySlug is memoized, the page reuses it.
export default async function GameLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game || storeCount(game) === 0) notFound();
  if (slug !== game.slug) permanentRedirect(`/games/${game.slug}`);
  return children;
}
