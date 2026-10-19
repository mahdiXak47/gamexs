import { Card } from "@heroui/react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AutoRefresh } from "@/components/AutoRefresh";
import { StatusChip } from "@/components/StatusChip";
import { StepLog } from "@/components/StepLog";
import { StepProgress } from "@/components/StepProgress";
import { STEP_LABELS, formatAgo, formatDateTime, formatDuration } from "@/lib/format";
import { runStalled, stepProgress } from "@/lib/progress";
import { getRun, runSteps, storeHealth } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: `Run #${(await params).id}` };
}

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();
  const now = new Date();
  const [steps, stores] = await Promise.all([runSteps(run.id, true), storeHealth()]);
  const names = new Map(stores.map((s) => [s.slug, s.name]));

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/runs" className="hover:text-foreground hover:underline">Run history</Link> / #{run.id}
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Run #{run.id}</h1>
          <StatusChip status={runStalled(run, steps, now) ? "stalled" : run.status} size="md" />
          <span className="text-sm text-muted">
            {formatDateTime(run.started_at)} · {formatDuration(((run.completed_at ?? now).getTime() - run.started_at.getTime()) / 1000)}
            {run.summary ? ` · failed: ${run.summary}` : ""}
          </span>
        </div>
        <AutoRefresh renderedAt={now.toISOString()} />
      </div>

      <ol className="flex flex-col gap-3">
        {steps.map((step) => {
          const p = stepProgress(step, now);
          const label = names.get(step.name) ?? STEP_LABELS[step.name] ?? step.name;
          return (
            <li key={step.id}>
              <Card className="gap-3 p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="tabular w-6 text-sm text-muted">{step.position + 1}.</span>
                  <Link href={`/steps/${step.name}`} className="min-w-40 font-medium hover:text-accent hover:underline">{label}</Link>
                  <StatusChip status={p.stalled ? "stalled" : step.status} />
                  <div className="min-w-56 flex-1">
                    <StepProgress status={step.status} progress={p} label={label} />
                  </div>
                  <dl className="tabular flex gap-5 text-xs">
                    <div><dt className="text-muted">Started</dt><dd>{step.started_at ? formatDateTime(step.started_at) : "—"}</dd></div>
                    <div><dt className="text-muted">Elapsed</dt><dd>{formatDuration(p.elapsedSeconds)}</dd></div>
                    <div><dt className="text-muted">Last update</dt><dd>{formatAgo(step.completed_at ?? step.heartbeat_at, now)}</dd></div>
                    {step.exit_code !== null ? <div><dt className="text-muted">Exit</dt><dd className={step.exit_code ? "text-danger" : ""}>{step.exit_code}</dd></div> : null}
                  </dl>
                </div>
                {step.message ? <p className="ps-10 text-xs text-muted">{step.message}</p> : null}
                {step.status !== "queued" ? (
                  <div className="ps-10">
                    <StepLog log={step.log_tail} defaultExpanded={step.status === "running" || step.status === "failed"} />
                  </div>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ol>
    </>
  );
}
