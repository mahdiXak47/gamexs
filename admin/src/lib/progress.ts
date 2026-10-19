// Pure progress/ETA math for pipeline steps. No I/O, so it is unit-checked
// in scripts/check-progress.mts.

export const STALL_SECONDS = 120; // a running step heartbeats every 10 s

export type ProgressInput = {
  status: string;
  progress_done: number | null;
  progress_total: number | null;
  started_at: Date | null;
  heartbeat_at: Date | null;
  completed_at: Date | null;
  typical_seconds: number | null;
};

export type Progress = {
  /** 0–100, or null when the total is unknown (first run of a step). */
  percent: number | null;
  done: number;
  total: number | null;
  remaining: number | null;
  /** Items per minute since the step started. */
  ratePerMinute: number | null;
  /** Seconds left; null when it cannot be estimated. */
  etaSeconds: number | null;
  elapsedSeconds: number | null;
  /** Running but no heartbeat for STALL_SECONDS. */
  stalled: boolean;
};

export function stepProgress(step: ProgressInput, now: Date = new Date()): Progress {
  const done = step.progress_done ?? 0;
  // A crawl can exceed last run's count; keep the bar honest instead of >100%.
  const total = step.progress_total && step.progress_total > 0 ? Math.max(step.progress_total, done) : null;
  const end = step.completed_at ?? (step.status === "running" ? now : null);
  const elapsedSeconds = step.started_at && end ? Math.max(0, (end.getTime() - step.started_at.getTime()) / 1000) : null;

  if (step.status === "succeeded") {
    return { percent: 100, done, total: total ?? done, remaining: 0, ratePerMinute: rate(done, elapsedSeconds), etaSeconds: 0, elapsedSeconds, stalled: false };
  }

  const percent = total ? Math.min(100, (done / total) * 100) : null;
  const remaining = total !== null ? total - done : null;
  const ratePerMinute = rate(done, elapsedSeconds);

  let etaSeconds: number | null = null;
  if (step.status === "running") {
    // Past last run's count the total is no longer a useful estimate.
    if (remaining && ratePerMinute) etaSeconds = (remaining / ratePerMinute) * 60;
    else if (remaining === null && step.typical_seconds && elapsedSeconds !== null && elapsedSeconds < step.typical_seconds)
      etaSeconds = step.typical_seconds - elapsedSeconds;
  } else if (step.status === "queued") {
    etaSeconds = step.typical_seconds;
  }

  const stalled =
    step.status === "running" &&
    !!step.heartbeat_at &&
    (now.getTime() - step.heartbeat_at.getTime()) / 1000 > STALL_SECONDS;

  return { percent, done, total, remaining, ratePerMinute, etaSeconds, elapsedSeconds, stalled };
}

function rate(done: number, elapsedSeconds: number | null): number | null {
  // Under ~30 s of data the rate is mostly noise.
  if (!done || !elapsedSeconds || elapsedSeconds < 30) return null;
  return done / (elapsedSeconds / 60);
}

/** Latest sign of life from any step of a run. */
export function lastActivity(steps: Pick<ProgressInput, "heartbeat_at" | "completed_at">[]): Date | null {
  return steps.reduce<Date | null>((latest, s) => {
    const t = s.heartbeat_at ?? s.completed_at;
    return t && (!latest || t > latest) ? t : latest;
  }, null);
}

/** A run still marked running with no sign of life for STALL_SECONDS (pod died or hung). */
export function runStalled(run: { status: string; started_at: Date }, steps: Pick<ProgressInput, "heartbeat_at" | "completed_at">[], now: Date = new Date()): boolean {
  if (run.status !== "running") return false;
  const last = lastActivity(steps) ?? run.started_at;
  return (now.getTime() - last.getTime()) / 1000 > STALL_SECONDS;
}

/** Time left for the whole run: running step's ETA + typical durations of queued steps. */
export function runEtaSeconds(steps: ProgressInput[], now: Date = new Date()): number | null {
  let total = 0;
  let known = false;
  for (const step of steps) {
    if (step.status !== "running" && step.status !== "queued") continue;
    const eta = stepProgress(step, now).etaSeconds;
    if (eta === null) return null; // any unknown step makes the sum misleading
    total += eta;
    known = true;
  }
  return known ? total : null;
}
