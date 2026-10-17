// S3 object storage — single source of truth for cover/background/screenshot images.
// No node:fs — safe to import from any component boundary.
//
// S3_ENDPOINT_URL (and optionally S3_BUCKET) come from runtime env only — no
// host is hardcoded, so switching storage endpoints is an env change. These
// values are server-only: client components must receive the base URL as a
// prop from a Server Component (see app/account/page.tsx).

// The browser must fetch covers over HTTPS — many proxies refuse plain-HTTP
// CONNECT, so force HTTPS even if S3_ENDPOINT_URL is http://.
const S3_ORIGIN = (process.env.S3_ENDPOINT_URL ?? "")
  .replace(/\/$/, "")
  .replace(/^http:\/\//, "https://");
const S3_BUCKET = process.env.S3_BUCKET ?? "gamexs";
const S3_PATH_PREFIX = `/${S3_BUCKET}/`;

export const S3_BASE = `${S3_ORIGIN}/${S3_BUCKET}`;

// Object key of a GameXS media URL, identified by the bucket path prefix —
// not by host, because the DB keeps absolute URLs from whichever endpoint was
// configured when the scraper wrote them.
function s3Key(url: string): string | null {
  try {
    const { pathname } = new URL(url, "https://placeholder.invalid");
    return pathname.startsWith(S3_PATH_PREFIX) ? pathname.slice(S3_PATH_PREFIX.length) : null;
  } catch {
    return null;
  }
}

/** Whether a URL points at GameXS's immutable object-storage media. */
export function isS3ImageUrl(url: string | null | undefined): url is string {
  return !!url && s3Key(url) !== null;
}

/** Rebase a stored S3 URL onto the currently configured endpoint. */
export function normalizeS3Url(url: string, base: string = S3_BASE): string {
  const key = s3Key(url);
  return key === null ? url : `${base}/${key}`;
}

/** Canonical S3 URL for a game's main cover image. */
export function s3CoverUrl(slug: string, base: string = S3_BASE): string {
  return `${base}/covers/${slug}-main-cover.webp`;
}

/** Canonical S3 URL for a game's legacy artwork image. */
export function s3ArtworkUrl(slug: string): string {
  return `${S3_BASE}/artworks/${slug}-key-art.webp`;
}

/** Canonical S3 URL for a game's main background image.
 *
 * Use the legacy artwork prefix as a fallback for games that do not yet have
 * a dedicated main background uploaded. Stored main-background-images URLs
 * are preserved by normalizeMainBackgroundImageUrl below.
 */
export function s3MainBackgroundImageUrl(slug: string): string {
  return s3ArtworkUrl(slug);
}

export function normalizeMainBackgroundImageUrl(url: string | null, slug: string): string {
  if (!url) return s3MainBackgroundImageUrl(slug);
  return normalizeS3Url(url);
}

/** Canonical S3 URL for a screenshot filename as stored in screenshot_ids. */
export function s3ScreenshotUrl(filename: string): string {
  return `${S3_BASE}/screenshots/${filename}`;
}
