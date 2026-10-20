import type { ClickBucket } from "@/lib/queries";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Buckets arrive as Tehran wall-clock text; label them without any Date/timezone conversion. */
function label(bucket: string, unit: "hour" | "day" | "month") {
  const [date, time] = bucket.split(" ");
  const [y, m, d] = date.split("-");
  if (unit === "hour") return time;
  if (unit === "day") return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

/** Clicks per bucket; the darker inner bar is unique visitors. A hidden table carries the numbers. */
export function ClickBars({ buckets, unit }: { buckets: ClickBucket[]; unit: "hour" | "day" | "month" }) {
  if (!buckets.length) return <p className="text-sm text-muted">No clicks in this period yet.</p>;
  const max = Math.max(1, ...buckets.map((b) => b.clicks));
  const fmt = (b: string) => label(b, unit);
  return (
    <figure className="flex flex-col gap-3">
      <div className="flex h-40 items-end gap-1" aria-hidden>
        {buckets.map((b) => (
          <div key={b.bucket} className="relative flex h-full flex-1 items-end" title={`${fmt(b.bucket)}: ${b.clicks} clicks, ${b.unique_visitors} unique`}>
            <div className="w-full rounded-t-sm bg-accent/35" style={{ height: `${(b.clicks / max) * 100}%`, minHeight: 2 }} />
            <div className="absolute bottom-0 w-full rounded-t-sm bg-accent" style={{ height: `${(b.unique_visitors / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted tabular" aria-hidden>
        <span>{fmt(buckets[0].bucket)}</span>
        <span>{fmt(buckets[buckets.length - 1].bucket)}</span>
      </div>
      <figcaption className="flex gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent/35" />Clicks</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" />Unique visitors</span>
      </figcaption>
      <table className="sr-only">
        <caption>Clicks over time</caption>
        <thead><tr><th>Period</th><th>Clicks</th><th>Unique visitors</th></tr></thead>
        <tbody>{buckets.map((b) => <tr key={b.bucket}><td>{fmt(b.bucket)}</td><td>{b.clicks}</td><td>{b.unique_visitors}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
