// Display formatting. Times are shown in Tehran time, where the business runs.

const TZ = "Asia/Tehran";
const numberFormat = new Intl.NumberFormat("en-US");
const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const timeOnly = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export const formatNumber = (n: number | null | undefined) => (n === null || n === undefined ? "—" : numberFormat.format(Math.round(n)));
export const formatDateTime = (d: Date | null | undefined) => (d ? dateTime.format(d) : "—");
export const formatTime = (d: Date) => timeOnly.format(d);

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${String(m % 60).padStart(2, "0")}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function formatAgo(d: Date | null | undefined, now: Date = new Date()): string {
  if (!d) return "never";
  const seconds = (now.getTime() - d.getTime()) / 1000;
  if (seconds < 0) return "just now";
  if (seconds < 45) return `${Math.round(seconds)}s ago`;
  return `${formatDuration(seconds).split(" ")[0]} ago`;
}

/** Hours since a timestamp — used to colour data freshness. */
export const hoursSince = (d: Date | null | undefined, now: Date = new Date()) =>
  d ? (now.getTime() - d.getTime()) / 3_600_000 : Number.POSITIVE_INFINITY;

export const STEP_LABELS: Record<string, string> = {
  igdb: "IGDB enrichment",
  psstore: "PlayStation Store prices",
  s3: "Cover upload (S3)",
  cleanup: "Stale-listing cleanup",
  uperagame: "Upera Game",
};
