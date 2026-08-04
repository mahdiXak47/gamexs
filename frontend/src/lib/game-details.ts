import fs from "node:fs";
import path from "node:path";

// Server-only (uses fs) — import only from Server Components, never from
// "use client" files. Same pattern as lib/covers.ts.

export interface GameDetails {
  developers: string[];
  genres: string[];
  themes: string[];
  gameModes: string[];
  playerPerspectives: string[];
  series: string[];
  franchises: string[];
  gameEngines: string[];
  summary: string;
  keywords: string[];
}

const DETAILS_DIR = path.join(
  process.cwd(),
  "..",
  "scraper",
  "output",
  "game_details"
);

function detailSlugCandidates(slug: string): string[] {
  return Array.from(new Set([
    slug,
    slug.replace(/-/g, "_"),
    slug.replace(/_/g, "-"),
  ]));
}

export function getGameDetails(slug: string): GameDetails | null {
  for (const candidate of detailSlugCandidates(slug)) {
    const filePath = path.join(DETAILS_DIR, `${candidate}.json`);
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return {
        developers:         raw.developers         ?? [],
        genres:             raw.genres             ?? [],
        themes:             raw.themes             ?? [],
        gameModes:          raw.game_modes         ?? [],
        playerPerspectives: raw.player_perspectives ?? [],
        series:             raw.series             ?? [],
        franchises:         raw.franchises         ?? [],
        gameEngines:        raw.game_engines       ?? [],
        summary:            raw.summary            ?? "",
        keywords:           raw.keywords           ?? [],
      };
    } catch {
      continue;
    }
  }
  return null;
}
