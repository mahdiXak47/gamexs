// S3 object storage — single source of truth for cover/screenshot images.
// No node:fs — safe to import from any component boundary.
//
// S3_ENDPOINT_URL and S3_BUCKET are read from env (set in .env.local for
// local dev, injected as k8s secrets in production). Both default to the
// canonical production values so the module works without any extra config.

const S3_ORIGIN = (process.env.S3_ENDPOINT_URL ?? "http://gs3.gamexs.ir").replace(/\/$/, "");
const S3_BUCKET = process.env.S3_BUCKET ?? "gamexs";

export const S3_BASE = `${S3_ORIGIN}/${S3_BUCKET}`;

/** Canonical S3 URL for a game's main cover image. */
export function s3CoverUrl(slug: string): string {
  return `${S3_BASE}/covers/${slug}-main-cover.webp`;
}

/** Canonical S3 URL for a screenshot filename as stored in screenshot_ids. */
export function s3ScreenshotUrl(filename: string): string {
  return `${S3_BASE}/screenshots/${filename}`;
}
