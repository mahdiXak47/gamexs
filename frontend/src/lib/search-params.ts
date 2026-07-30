import type { SortOption } from "./types";

const VALID_SORTS = new Set<SortOption>([
  "popular",
  "newest",
  "price_asc",
  "price_desc",
  "alpha_asc",
  "alpha_desc",
]);

export interface GameListParams {
  query: string;
  sort: SortOption;
  publishers: string[];
  page: number;
}

// Shared by every page that renders GameGrid (homepage, genre, search) so
// the ?q=&sort=&publisher=&page= convention only needs to be parsed once.
export function parseGameListSearchParams(
  sp: Record<string, string | string[] | undefined>
): GameListParams {
  const q = typeof sp.q === "string" ? sp.q : "";
  const sortRaw = typeof sp.sort === "string" ? sp.sort : "";
  const sort = VALID_SORTS.has(sortRaw as SortOption) ? (sortRaw as SortOption) : "popular";
  const publishers = typeof sp.publisher === "string" && sp.publisher.length > 0
    ? sp.publisher.split(",")
    : [];
  const pageRaw = typeof sp.page === "string" ? parseInt(sp.page, 10) : 1;
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  return { query: q, sort, publishers, page };
}
