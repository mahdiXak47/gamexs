import fs from "node:fs";
import path from "node:path";

// Server-only (uses fs) — call only from Server Components/Route Handlers,
// never from a "use client" file or anything it imports, or the client
// bundle will try to include node:fs and fail to build.
//
// Reads directly from the scraper's output directory rather than copying
// images into frontend/public: keeps a single source of truth for local dev.
// In production this whole module goes away in favor of an object-storage
// URL stored alongside each game (see TODO.md).

const COVERS_DIR = path.join(process.cwd(), "..", "scraper", "output", "images", "pspro");

function slugify(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
}

let cachedFiles: string[] | null = null;

function listCoverFiles(): string[] {
  if (cachedFiles) return cachedFiles;
  try {
    cachedFiles = fs.readdirSync(COVERS_DIR);
  } catch {
    cachedFiles = [];
  }
  return cachedFiles;
}

export function findCoverFile(title: string): string | null {
  const slug = slugify(title.toLowerCase());
  const files = listCoverFiles();

  const exact = files.find((f) => f.toLowerCase() === slug + ".jpg" || f.toLowerCase() === slug + ".jpeg");
  if (exact) return exact;

  // Same base title under a different edition/SKU suffix (e.g. a "Director's
  // Cut" cover for a game we only have the base edition of in mock data) is
  // still a reasonable stand-in cover.
  const prefixed = files.find((f) => f.toLowerCase().startsWith(slug + "-"));
  return prefixed ?? null;
}

export function coverUrl(title: string): string | null {
  const file = findCoverFile(title);
  return file ? `/api/covers/${encodeURIComponent(file)}` : null;
}
