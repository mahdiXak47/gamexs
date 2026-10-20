import { notFound } from "next/navigation";
import { genreBySlug } from "@/lib/genres";

// Unknown genre → real 404 before the segment's loading.tsx streams a 200.
export default async function GenreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  if (!genreBySlug((await params).slug)) notFound();
  return children;
}
