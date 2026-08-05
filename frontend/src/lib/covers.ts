// S3 object storage — single source of truth for cover/screenshot images.
// No node:fs — safe to import from any component boundary.
//
// S3_ENDPOINT_URL and S3_BUCKET are read from env (set in .env.local for
// local dev, injected as k8s secrets in production). Both default to the
// canonical production values so the module works without any extra config.

// The image optimizer / browser must fetch covers over HTTPS — many proxies
// refuse plain-HTTP CONNECT. Keep gs3 HTTPS even if S3_ENDPOINT_URL is set to
// an http:// value (as the scraper writes to the DB).
const s3Endpoint = (process.env.S3_ENDPOINT_URL ?? "https://gs3.gamexs.ir").replace(/\/$/, "");
export const S3_ORIGIN = s3Endpoint.includes("gs3.gamexs.ir") ? s3Endpoint.replace(/^http:\/\//, "https://") : s3Endpoint;
const S3_BUCKET = process.env.S3_BUCKET ?? "gamexs";

export const S3_BASE = `${S3_ORIGIN}/${S3_BUCKET}`;

// The image optimizer / browser must fetch covers over HTTPS — many proxies
// refuse plain-HTTP CONNECT. The scraper stores `http://gs3.gamexs.ir/...` in
// `cover_url`, so normalize any gs3 URL to HTTPS before it reaches <Image>.
export function normalizeS3Url(url: string): string {
  if (url.includes("gs3.gamexs.ir")) {
    return url.replace(/^http:\/\//, "https://");
  }
  return url;
}

/** Canonical S3 URL for a game's main cover image. */
export function s3CoverUrl(slug: string): string {
  return `${S3_BASE}/covers/${slug}-main-cover.webp`;
}

/** Canonical S3 URL for a screenshot filename as stored in screenshot_ids. */
export function s3ScreenshotUrl(filename: string): string {
  return `${S3_BASE}/screenshots/${filename}`;
}
