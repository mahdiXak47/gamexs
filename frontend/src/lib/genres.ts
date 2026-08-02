// headerColor overrides the shared blue .ps-header band on the genre page
// with a flat genre-specific color — null entries just keep the default blue.
// Explicit null (not omitted) on every entry so TS gives every genre the same
// shape instead of only the ones with a color.
const NO_COLOR: string | null = null;

export const GENRES = [
  { slug: "shooter",       label: "بازی‌های شوتر",        genre: "Shooter",       headerColor: "#262628" },
  { slug: "role-playing",  label: "بازی‌های نقش‌آفرینی",  genre: "Role-playing", headerColor: NO_COLOR },
  { slug: "adventure",     label: "بازی‌های ماجراجویی",   genre: "Adventure",    headerColor: NO_COLOR },
  { slug: "platform",      label: "بازی‌های پلتفرمر",     genre: "Platform",     headerColor: NO_COLOR },
  { slug: "simulator",     label: "بازی‌های شبیه‌سازی",   genre: "Simulator",    headerColor: NO_COLOR },
  { slug: "racing",        label: "بازی‌های مسابقه‌ای",   genre: "Racing",       headerColor: NO_COLOR },
  { slug: "fighting",      label: "بازی‌های مبارزه‌ای",   genre: "Fighting",     headerColor: NO_COLOR },
  { slug: "puzzle",        label: "بازی‌های پازل",        genre: "Puzzle",       headerColor: NO_COLOR },
  { slug: "hack-and-slash",label: "هک و اسلش",            genre: "Hack",         headerColor: NO_COLOR },
  { slug: "strategy",      label: "بازی‌های استراتژی",    genre: "Strategy",     headerColor: NO_COLOR },
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
