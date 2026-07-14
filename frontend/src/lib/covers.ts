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

// Returns a local URL for a screenshot image_id if the file was downloaded.
export function screenshotUrl(imageId: string): string | null {
  try {
    fs.accessSync(path.join(SCREENSHOTS_DIR, `${imageId}.jpg`));
    return `/api/screenshots/${encodeURIComponent(imageId)}.jpg`;
  } catch {
    return null;
  }
}

// Returns a local /api/covers/ URL if an IGDB-downloaded cover exists for this slug
// (i.e. {slug}-main-cover.webp in the covers/ output dir). Used when the DB row
// hasn't been updated yet via update_local_paths.py.
export function localIgdbCoverUrl(slug: string): string | null {
  const filename = `${slug}-main-cover.webp`;
  try {
    fs.accessSync(path.join(IGDB_DOWNLOAD_COVERS_DIR, filename));
    return `/api/covers/${encodeURIComponent(filename)}`;
  } catch {
    return null;
  }
}

// Scans the screenshots output dir for {slug}-catalog-pic-{n}.webp files
// and returns their /api/screenshots/ URLs. Falls back when screenshot_ids
// is not yet stored in the DB.
export function localScreenshotUrls(slug: string): string[] {
  const results: string[] = [];
  for (let n = 1; n <= 20; n++) {
    const filename = `${slug}-catalog-pic-${n}.webp`;
    try {
      fs.accessSync(path.join(SCREENSHOTS_DIR, filename));
      results.push(`/api/screenshots/${encodeURIComponent(filename)}`);
    } catch {
      break;
    }
  }
  return results;
}
