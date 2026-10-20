import { Card, Chip, ProgressBar, Table } from "@heroui/react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AutoRefresh } from "@/components/AutoRefresh";
import { HistoryBars } from "@/components/HistoryBars";
import { Icon, type IconName } from "@/components/Icon";
import { StatusChip } from "@/components/StatusChip";
import { StepProgress } from "@/components/StepProgress";
import { STEP_LABELS, formatAgo, formatDateTime, formatDuration, formatNumber, hoursSince } from "@/lib/format";
import { lastActivity, runEtaSeconds, runStalled, stepProgress } from "@/lib/progress";
import {
  dailyOutcomes,
  freshness,
  latestRun,
  recentFailures,
  runSteps,
  storeHealth,
  type PipelineRun,
  type PipelineStep,
} from "@/lib/queries";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  await connection();
  const now = new Date();
  const [run, fresh, stores, days, failures] = await Promise.all([
    latestRun(),
    freshness(),
    storeHealth(),
    dailyOutcomes(14),
    recentFailures(10),
  ]);
  const steps = run ? await runSteps(run.id) : [];
  const sellerNames = new Map(stores.map((s) => [s.slug, s.name]));
  const ok7 = stores.reduce((n, s) => n + s.ok_7d, 0);
  const failed7 = stores.reduce((n, s) => n + s.failed_7d, 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline overview</h1>
          <p className="text-sm text-muted">Shop scrapes, PlayStation Store prices and IGDB enrichment, refreshed live.</p>
        </div>
        <AutoRefresh renderedAt={now.toISOString()} />
      </div>

      <CurrentRun run={run} steps={steps} names={sellerNames} now={now} />

      <section aria-label="Data freshness" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FreshnessTile label="Shop prices updated" at={fresh.last_price_at} now={now} />
        <FreshnessTile label="PlayStation Store prices" at={fresh.last_psstore_at} now={now} />
        <Tile icon="database" label="Active listings" value={formatNumber(fresh.active_listings)} hint={`${fresh.sellers_with_listings} shops · ${formatNumber(fresh.catalog_games)} games`} />
        <Tile
          icon="activity"
          label="Shop scrape success (7 days)"
          value={ok7 + failed7 ? `${Math.round((ok7 / (ok7 + failed7)) * 100)}%` : "—"}
          hint={`${ok7} succeeded · ${failed7} failed`}
          tone={failed7 > ok7 ? "danger" : failed7 ? "warning" : "success"}
        />
      </section>

      {run ? (
        <Card className="p-0">
          <Card.Header className="flex flex-row items-center justify-between px-5 pt-5">
            <div>
              <Card.Title>Steps in run #{run.id}</Card.Title>
              <Card.Description>Shops run one after another, then enrichment, PS Store prices, cover upload and cleanup.</Card.Description>
            </div>
            <Link href={`/runs/${run.id}`} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
              Logs <Icon name="chevron" />
            </Link>
          </Card.Header>
          <Card.Content className="px-2 pb-2">
            <StepsTable steps={steps} names={sellerNames} now={now} runId={run.id} />
          </Card.Content>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="p-0">
          <Card.Header className="px-5 pt-5">
            <Card.Title>Shop health</Card.Title>
            <Card.Description>Last 30 days of per-shop scrapes, including retries.</Card.Description>
          </Card.Header>
          <Card.Content className="px-2 pb-2">
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Shop health" selectionMode="none">
                  <Table.Header>
                    <Table.Column isRowHeader>Shop</Table.Column>
                    <Table.Column>Last run</Table.Column>
                    <Table.Column>Last success</Table.Column>
                    <Table.Column className="text-end">7d ok / fail</Table.Column>
                    <Table.Column className="text-end">Listings</Table.Column>
                    <Table.Column className="text-end">Typical</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {stores.map((s) => (
                      <Table.Row key={s.slug} id={s.slug}>
                        <Table.Cell>
                          <Link href={`/steps/${s.slug}`} className="font-medium hover:text-accent hover:underline">
                            {s.name}
                          </Link>
                          <div className="text-xs text-muted">{s.domain}</div>
                        </Table.Cell>
                        <Table.Cell>
                          {s.last_status ? <StatusChip status={s.last_status} /> : <span className="text-xs text-muted">never ran</span>}
                        </Table.Cell>
                        <Table.Cell className="tabular text-sm">
                          <span title={formatDateTime(s.last_success_at)} className={hoursSince(s.last_success_at, now) > 30 ? "text-warning" : ""}>{formatAgo(s.last_success_at, now)}</span>
                        </Table.Cell>
                        <Table.Cell className="tabular text-end text-sm">
                          <span className="text-success">{s.ok_7d}</span>
                          <span className="text-muted"> / </span>
                          <span className={s.failed_7d ? "text-danger" : "text-muted"}>{s.failed_7d}</span>
                        </Table.Cell>
                        <Table.Cell className="tabular text-end text-sm">{formatNumber(s.active_listings)}</Table.Cell>
                        <Table.Cell className="tabular text-end text-sm text-muted">{formatDuration(s.typical_seconds)}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Card.Content>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <Card.Header>
              <Card.Title>Outcomes, last 14 days</Card.Title>
              <Card.Description>Every shop scrape and pipeline task, by start day (Tehran time).</Card.Description>
            </Card.Header>
            <Card.Content>
              <HistoryBars days={days} />
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Recent failures</Card.Title>
            </Card.Header>
            <Card.Content>
              {failures.length ? (
                <ul className="flex flex-col divide-y divide-border">
                  {failures.map((f, i) => (
                    <li key={i} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <Link href={`/steps/${f.source}`} className="inline-flex items-center gap-1.5 font-medium hover:text-accent hover:underline">
                          <Icon name="x" className="h-3.5 w-3.5 text-danger" />
                          {sellerNames.get(f.source) ?? STEP_LABELS[f.source] ?? f.source}
                          {f.attempt ? <span className="font-normal text-muted">· attempt {f.attempt}</span> : null}
                        </Link>
                        <span className="tabular shrink-0 text-xs text-muted" title={formatDateTime(f.at)}>{formatAgo(f.at, now)}</span>
                      </div>
                      <p className="line-clamp-2 break-all font-mono text-xs text-muted" title={f.error ?? undefined}>
                        {f.error ?? "no error recorded"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="inline-flex items-center gap-2 text-sm text-muted"><Icon name="check" className="h-4 w-4 text-success" />No failures recorded.</p>
              )}
            </Card.Content>
          </Card>
        </div>
      </div>
    </>
  );
}

function CurrentRun({ run, steps, names, now }: { run: PipelineRun | null; steps: PipelineStep[]; names: Map<string, string>; now: Date }) {
  if (!run) {
    return (
      <Card>
        <Card.Header>
          <Card.Title>No pipeline runs recorded yet</Card.Title>
          <Card.Description>
            Runs appear here once the scraper starts a cycle with progress tracking (DB migration 033 and scraper image with
            <code className="mx-1 font-mono">gamexs_scraper.pipeline</code>).
          </Card.Description>
        </Card.Header>
      </Card>
    );
  }
  const finished = run.steps_succeeded + run.steps_failed + run.steps_skipped;
  const running = steps.find((s) => s.status === "running");
  const lastBeat = lastActivity(steps);
  const live = run.status === "running";
  const stalled = runStalled(run, steps, now);
  const eta = live && !stalled ? runEtaSeconds(steps, now) : null;
  const elapsed = ((run.completed_at ?? now).getTime() - run.started_at.getTime()) / 1000;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip status={stalled ? "stalled" : run.status} size="md" />
          <h2 className="text-lg font-semibold">
            <Link href={`/runs/${run.id}`} className="hover:text-accent hover:underline">
              Run #{run.id}
            </Link>
          </h2>
          <span className="text-sm text-muted">
            started {formatAgo(run.started_at, now)} · {formatDateTime(run.started_at)}
          </span>
          {run.steps_failed ? (
            <Chip color="danger" variant="soft" size="sm">
              <Chip.Label>{run.steps_failed} failed</Chip.Label>
            </Chip>
          ) : null}
        </div>

        <ProgressBar
          aria-label="Run progress"
          value={run.steps_total ? (finished / run.steps_total) * 100 : 0}
          color={run.steps_failed ? "warning" : live ? "accent" : "success"}
        >
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <Stat label="Steps done" value={`${finished} / ${run.steps_total}`} />
          <Stat
            label="Now running"
            value={running ? (names.get(running.name) ?? STEP_LABELS[running.name] ?? running.name) : live ? "between steps" : "—"}
          />
          <Stat label={live ? "Elapsed" : "Took"} value={formatDuration(elapsed)} />
          <Stat
            label={live ? "Estimated time left" : "Finished"}
            value={live ? (stalled ? "—" : eta !== null ? `~${formatDuration(eta)}` : "estimating…") : formatAgo(run.completed_at, now)}
          />
        </dl>
        <p className={`inline-flex flex-wrap items-center gap-1.5 text-xs ${stalled ? "text-warning" : "text-muted"}`}>
          {stalled ? <Icon name="alert" className="h-3.5 w-3.5" /> : null}
          {stalled ? "No sign of life for over 2 minutes — the scraper pod probably restarted or hung; the next cycle will mark this run abandoned. " : ""}
          Last update from the scraper: {formatAgo(lastBeat, now)}
          {run.summary ? ` · ${run.summary}` : ""}
        </p>
      </div>
    </Card>
  );
}

function StepsTable({ steps, names, now, runId }: { steps: PipelineStep[]; names: Map<string, string>; now: Date; runId: string }) {
  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Pipeline steps" selectionMode="none">
          <Table.Header>
            <Table.Column isRowHeader>Step</Table.Column>
            <Table.Column>Status</Table.Column>
            <Table.Column>Progress</Table.Column>
            <Table.Column className="text-end">Elapsed</Table.Column>
            <Table.Column className="text-end">ETA</Table.Column>
            <Table.Column>Last update</Table.Column>
          </Table.Header>
          <Table.Body>
            {steps.map((step) => {
              const p = stepProgress(step, now);
              const label = names.get(step.name) ?? STEP_LABELS[step.name] ?? step.name;
              return (
                <Table.Row key={step.id} id={step.id}>
                  <Table.Cell>
                    <Link href={`/steps/${step.name}`} className="font-medium hover:text-accent hover:underline">
                      {label}
                    </Link>
                    {step.message ? (
                      <div className="max-w-64 truncate text-xs text-muted" title={step.message}>
                        {step.message}
                      </div>
                    ) : null}
                    {names.has(step.name) && step.started_at ? (
                      <Link href={`/runs/${runId}/prices/${step.name}`} className="text-xs text-accent hover:underline">
                        Price updates
                      </Link>
                    ) : null}
                  </Table.Cell>
                  <Table.Cell>
                    <StatusChip status={p.stalled ? "stalled" : step.status} />
                  </Table.Cell>
                  <Table.Cell>
                    <StepProgress status={step.status} progress={p} label={label} />
                  </Table.Cell>
                  <Table.Cell className="tabular text-end text-sm">{formatDuration(p.elapsedSeconds)}</Table.Cell>
                  <Table.Cell className="tabular text-end text-sm">
                    {step.status === "running" ? (p.etaSeconds !== null ? `~${formatDuration(p.etaSeconds)}` : "estimating…") : "—"}
                  </Table.Cell>
                  <Table.Cell className="tabular text-xs text-muted">
                    {step.status === "queued" ? "waiting" : formatAgo(step.completed_at ?? step.heartbeat_at, now)}
                    {step.exit_code ? <span className="text-danger"> · exit {step.exit_code}</span> : null}
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  );
}

const TONE_CLASS = { success: "bg-success/15 text-success", warning: "bg-warning/15 text-warning", danger: "bg-danger/15 text-danger", default: "bg-surface-secondary text-muted" };

function Tile({ icon, label, value, hint, tone = "default" }: { icon: IconName; label: string; value: string; hint?: string; tone?: keyof typeof TONE_CLASS }) {
  return (
    <Card className="flex flex-row items-start gap-3 p-4">
      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_CLASS[tone]}`}>
        <Icon name={icon} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="tabular truncate text-lg font-semibold">{value}</p>
        {hint ? <p className="truncate text-xs text-muted">{hint}</p> : null}
      </div>
    </Card>
  );
}

function FreshnessTile({ label, at, now }: { label: string; at: Date | null; now: Date }) {
  const hours = hoursSince(at, now);
  const tone = hours < 30 ? "success" : hours < 72 ? "warning" : "danger";
  const icon: IconName = tone === "success" ? "check" : tone === "warning" ? "clock" : "alert";
  return <Tile icon={icon} label={label} value={formatAgo(at, now)} hint={at ? formatDateTime(at) : "no data yet"} tone={tone} />;
}
