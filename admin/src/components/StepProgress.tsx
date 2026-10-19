import { ProgressBar } from "@heroui/react";
import { formatDuration, formatNumber } from "@/lib/format";
import type { Progress } from "@/lib/progress";

const COLOR = { running: "accent", succeeded: "success", failed: "danger" } as const;

/** Bar + "done / total · rate · ETA". Indeterminate when the total is unknown. */
export function StepProgress({ status, progress, label }: { status: string; progress: Progress; label: string }) {
  if (status === "queued" || status === "skipped" || status === "abandoned") {
    return <span className="text-xs text-muted">{status === "queued" && progress.etaSeconds ? `usually ~${formatDuration(progress.etaSeconds)}` : "—"}</span>;
  }
  const color = progress.stalled ? "warning" : (COLOR[status as keyof typeof COLOR] ?? "default");
  const counts =
    progress.total !== null
      ? `${formatNumber(progress.done)} / ${formatNumber(progress.total)}`
      : progress.done
        ? `${formatNumber(progress.done)} so far`
        : "starting…";
  return (
    <div className="flex min-w-48 flex-col gap-1">
      <ProgressBar
        aria-label={`${label} progress`}
        value={progress.percent ?? undefined}
        isIndeterminate={status === "running" && progress.percent === null}
        color={color}
        size="sm"
      >
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <div className="tabular flex justify-between gap-3 text-xs text-muted">
        <span>
          {counts}
          {progress.percent !== null && status !== "succeeded" ? ` · ${Math.floor(progress.percent)}%` : ""}
        </span>
        {progress.ratePerMinute ? <span>{formatNumber(progress.ratePerMinute)}/min</span> : null}
      </div>
    </div>
  );
}
