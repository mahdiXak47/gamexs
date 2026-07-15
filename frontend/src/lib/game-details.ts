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

export function getGameDetails(slug: string): GameDetails | null {
  const filePath = path.join(DETAILS_DIR, `${slug}.json`);
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
    return null;
  }
}
