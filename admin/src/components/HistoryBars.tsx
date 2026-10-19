import type { DailyOutcome } from "@/lib/queries";

/**
 * Stacked daily bars of succeeded/failed scrapes. Failed is drawn hatched as
 * well as red so it does not rely on colour, and a visually-hidden table
 * carries the same numbers for screen readers.
 */
export function HistoryBars({ days }: { days: DailyOutcome[] }) {
  const max = Math.max(1, ...days.map((d) => d.succeeded + d.failed));
  const label = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return (
    <figure className="flex flex-col gap-3">
      <div className="flex h-36 items-end gap-1.5" aria-hidden>
        {days.map((d) => {
          const total = d.succeeded + d.failed;
          return (
            <div key={d.day} className="group flex h-full flex-1 flex-col justify-end" title={`${label(d.day)}: ${d.succeeded} succeeded, ${d.failed} failed`}>
              <div className="flex flex-col overflow-hidden rounded-sm" style={{ height: `${(total / max) * 100}%`, minHeight: total ? 3 : 0 }}>
                <div
                  className="bg-danger"
                  style={{
                    flexGrow: d.failed,
                    backgroundImage: "repeating-linear-gradient(135deg, transparent 0 3px, rgb(0 0 0 / 0.35) 3px 5px)",
                  }}
                />
                <div className="bg-success" style={{ flexGrow: d.succeeded }} />
              </div>
              <div className="mt-1 h-px bg-border" />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-muted tabular" aria-hidden>
        <span>{label(days[0].day)}</span>
        <span>{label(days[Math.floor(days.length / 2)].day)}</span>
        <span>Today</span>
      </div>
      <figcaption className="flex gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success" />Succeeded</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-danger" style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 2px, rgb(0 0 0 / 0.4) 2px 3px)" }} />
          Failed
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>Scrape outcomes per day</caption>
        <thead><tr><th>Day</th><th>Succeeded</th><th>Failed</th></tr></thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}><td>{d.day}</td><td>{d.succeeded}</td><td>{d.failed}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
