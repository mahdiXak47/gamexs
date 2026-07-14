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
const IGDB_COVERS_DIR = path.join(process.cwd(), "..", "scraper", "output", "images", "igdb");
const IGDB_DOWNLOAD_COVERS_DIR = path.join(process.cwd(), "..", "scraper", "output", "images", "covers");
const SCREENSHOTS_DIR = path.join(process.cwd(), "..", "scraper", "output", "images", "screenshots");

function slugify(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
}

let cachedPsproFiles: string[] | null = null;
let cachedIgdbCoverFiles: string[] | null = null;
let cachedScreenshotFiles: string[] | null = null;

function listCoverFiles(): string[] {
  if (cachedPsproFiles) return cachedPsproFiles;
  try { cachedPsproFiles = fs.readdirSync(COVERS_DIR); }
  catch { cachedPsproFiles = []; }
  return cachedPsproFiles;
}

function listIgdbCoverFiles(): string[] {
  if (cachedIgdbCoverFiles) return cachedIgdbCoverFiles;
  try { cachedIgdbCoverFiles = fs.readdirSync(IGDB_DOWNLOAD_COVERS_DIR); }
  catch { cachedIgdbCoverFiles = []; }
  return cachedIgdbCoverFiles;
}

function listScreenshotFiles(): string[] {
  if (cachedScreenshotFiles) return cachedScreenshotFiles;
  try { cachedScreenshotFiles = fs.readdirSync(SCREENSHOTS_DIR); }
  catch { cachedScreenshotFiles = []; }
  return cachedScreenshotFiles;
}

export function findCoverFile(title: string): string | null {
  const slug = slugify(title.toLowerCase());
  const files = listCoverFiles();

  const exact = files.find((f) => f.toLowerCase() === slug + ".jpg" || f.toLowerCase() === slug + ".jpeg");
  if (exact) return exact;

  // Same base title under a different edition/SKU suffix.
  const prefixed = files.find((f) => f.toLowerCase().startsWith(slug + "-"));
  if (prefixed) return prefixed;

  // Fuzzy pass: collapse consecutive dashes in both slug and filename.
  // Needed because the scraper slugifies raw titles that contain punctuation
  // (e.g. "007: First Light" → "007--first-light.jpg") while the DB stores
  // the clean title ("007 First Light") whose slug has only single dashes.
  const collapsed = slug.replace(/-+/g, "-");
  const fuzzy = files.find((f) => {
    const fn = f.toLowerCase().replace(/-+/g, "-");
    return fn === collapsed + ".jpg" || fn === collapsed + ".jpeg" || fn.startsWith(collapsed + "-");
  });
  return fuzzy ?? null;
}

export function coverUrl(title: string): string | null {
  const file = findCoverFile(title);
  return file ? `/api/covers/${encodeURIComponent(file)}` : null;
}

// Extract the IGDB image_id from a canonical IGDB URL such as
// https://images.igdb.com/igdb/image/upload/t_cover_big/coaoiz.jpg → "coaoiz"
function extractImageId(rawUrl: string): string | null {
  const m = rawUrl.match(/\/([a-zA-Z0-9]+)\.jpg(?:[?#]|$)/);
  return m ? m[1] : null;
}

// Returns a local URL if the IGDB cover was already downloaded by
// download_igdb_images.py, otherwise null.
export function igdbCoverUrl(rawUrl: string | null): string | null {
  if (!rawUrl?.includes("images.igdb.com")) return null;
  const imageId = extractImageId(rawUrl);
  if (!imageId) return null;
  try {
    fs.accessSync(path.join(IGDB_COVERS_DIR, `${imageId}.jpg`));
    return `/api/covers/igdb/${encodeURIComponent(imageId)}.jpg`;
  } catch {
    return null;
  }
}

// Returns a local URL for a legacy image_id-named screenshot if it was downloaded.
export function screenshotUrl(imageId: string): string | null {
  try {
    fs.accessSync(path.join(SCREENSHOTS_DIR, `${imageId}.jpg`));
    return `/api/screenshots/${encodeURIComponent(imageId)}.jpg`;
  } catch {
    return null;
  }
}

// Returns a local /api/covers/ URL if an IGDB-downloaded cover can be found for this slug.
// Checks in two passes:
//   1. Exact:  {slug}-main-cover.webp
//   2. Suffix: any file ending with -{slug}-main-cover.webp
// The suffix pass catches the common case where the download script wrote the file for
// a duplicate DB row whose slug has a prefix (e.g. "و-قیمت-black-myth-wukong-main-cover.webp"
// found for slug "black-myth-wukong").
export function localIgdbCoverUrl(slug: string): string | null {
  const files = listIgdbCoverFiles();
  const exact = `${slug}-main-cover.webp`;
  if (files.includes(exact)) return `/api/covers/${encodeURIComponent(exact)}`;
  const suffix = files.find((f) => f.endsWith(`-${slug}-main-cover.webp`));
  if (suffix) return `/api/covers/${encodeURIComponent(suffix)}`;
  return null;
}

// Returns /api/screenshots/ URLs for IGDB-downloaded screenshots for a slug.
// Used when screenshot_ids is not yet in the DB. Applies the same exact-then-suffix
// matching as localIgdbCoverUrl so it works even when files were saved under a
// prefixed duplicate slug.
export function localScreenshotUrls(slug: string): string[] {
  const files = listScreenshotFiles();
  const results: string[] = [];
  for (let n = 1; n <= 20; n++) {
    const exact = `${slug}-catalog-pic-${n}.webp`;
    const match =
      files.includes(exact) ? exact : files.find((f) => f.endsWith(`-${slug}-catalog-pic-${n}.webp`));
    if (!match) break;
    results.push(`/api/screenshots/${encodeURIComponent(match)}`);
  }
  return results;
}
