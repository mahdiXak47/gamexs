export const GENRES = [
  { slug: "shooter",       label: "بازی‌های شوتر",        genre: "Shooter" },
  { slug: "role-playing",  label: "بازی‌های نقش‌آفرینی",  genre: "Role-playing" },
  { slug: "adventure",     label: "بازی‌های ماجراجویی",   genre: "Adventure" },
  { slug: "platform",      label: "بازی‌های پلتفرمر",     genre: "Platform" },
  { slug: "simulator",     label: "بازی‌های شبیه‌سازی",   genre: "Simulator" },
  { slug: "racing",        label: "بازی‌های مسابقه‌ای",   genre: "Racing" },
  { slug: "fighting",      label: "بازی‌های مبارزه‌ای",   genre: "Fighting" },
  { slug: "puzzle",        label: "بازی‌های پازل",        genre: "Puzzle" },
  { slug: "hack-and-slash",label: "هک و اسلش",            genre: "Hack" },
  { slug: "strategy",      label: "بازی‌های استراتژی",    genre: "Strategy" },
] as const;

export type GenreSlug = (typeof GENRES)[number]["slug"];

export function genreBySlug(slug: string) {
  return GENRES.find((g) => g.slug === slug) ?? null;
}

// Reverse lookup: given a game's raw IGDB genre strings (e.g. "Role-playing
// (RPG)"), find the curated GENRES entry it belongs to for breadcrumb/nav
// linking. Substring match (not exact) since IGDB genre strings often carry
// extra qualifiers the curated list doesn't — e.g. "Role-playing (RPG)"
// should still resolve to the "role-playing" entry.
export function genreForGame(genres: string[]) {
  for (const genre of genres) {
    const match = GENRES.find((g) => genre.toLowerCase().includes(g.genre.toLowerCase()));
    if (match) return match;
  }
  return null;
}
