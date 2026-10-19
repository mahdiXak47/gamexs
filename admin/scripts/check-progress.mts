// Self-check for the progress/ETA math. Run: npx tsx scripts/check-progress.mts
import { runEtaSeconds, runStalled, stepProgress } from "../src/lib/progress.js";

const eq = (a: unknown, b: unknown, m: string) => { if (a !== b) throw new Error(`${m}: ${a} !== ${b}`); };
const now = new Date("2026-10-18T12:10:00Z");
const at = (min: number) => new Date(now.getTime() - min * 60_000);
const base = { completed_at: null, typical_seconds: null };

// 120 of 600 done in 10 min → 12/min, 480 left → 40 min.
const p = stepProgress({ ...base, status: "running", progress_done: 120, progress_total: 600, started_at: at(10), heartbeat_at: at(0) }, now);
eq(p.percent, 20, "percent");
eq(p.ratePerMinute, 12, "rate");
eq(p.etaSeconds, 2400, "eta");
eq(p.stalled, false, "not stalled");

// First run: no total → no percent, ETA falls back to nothing.
const first = stepProgress({ ...base, status: "running", progress_done: 50, progress_total: null, started_at: at(5), heartbeat_at: at(0) }, now);
eq(first.percent, null, "unknown percent");
eq(first.etaSeconds, null, "unknown eta");

// Overshooting last run's total clamps to 100% with no ETA.
const over = stepProgress({ ...base, status: "running", progress_done: 700, progress_total: 600, started_at: at(10), heartbeat_at: at(0) }, now);
eq(over.percent, 100, "clamped");
eq(over.etaSeconds, null, "no eta once past last run's total");

// No heartbeat for 3 min → stalled.
eq(stepProgress({ ...base, status: "running", progress_done: 1, progress_total: 10, started_at: at(10), heartbeat_at: at(3) }, now).stalled, true, "stalled");

// Run ETA = running ETA + queued typical durations; unknown queued step → null.
const queued = { ...base, status: "queued", progress_done: null, progress_total: null, started_at: null, heartbeat_at: null, typical_seconds: 600 };
const running = { ...base, status: "running", progress_done: 120, progress_total: 600, started_at: at(10), heartbeat_at: at(0) };
eq(runEtaSeconds([running, queued, queued], now), 3600, "run eta");
eq(runEtaSeconds([running, { ...queued, typical_seconds: null }], now), null, "unknown run eta");
// A run with no heartbeat for hours is stalled even between steps.
eq(runStalled({ status: "running", started_at: at(300) }, [{ heartbeat_at: null, completed_at: at(290) }], now), true, "run stalled");
eq(runStalled({ status: "running", started_at: at(5) }, [{ heartbeat_at: at(0), completed_at: null }], now), false, "run alive");
console.log("progress ok");
