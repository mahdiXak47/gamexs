import { Card, Table } from "@heroui/react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AutoRefresh } from "@/components/AutoRefresh";
import { StatusChip } from "@/components/StatusChip";
import { Icon } from "@/components/Icon";
import { StepLog } from "@/components/StepLog";
import { STEP_LABELS, formatAgo, formatDateTime, formatDuration, formatNumber } from "@/lib/format";
import { sellerExists, sellerRuns, stepHistory } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  return { title: STEP_LABELS[name] ?? name };
}

export default async function StepPage({ params }: { params: Promise<{ name: string }> }) {
  await connection();
  const { name } = await params;
  if (!/^[a-z0-9_-]{1,40}$/.test(name)) notFound();
  const [seller, history, runs] = await Promise.all([sellerExists(name), stepHistory(name, 10), sellerRuns(name, 30)]);
  if (!seller && !history.length) notFound();
  const now = new Date();
  const title = seller?.name ?? STEP_LABELS[name] ?? name;
  const ok = runs.filter((r) => r.status === "succeeded").length;
  const failed = runs.filter((r) => r.status === "failed").length;

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-foreground hover:underline">Overview</Link> / {title}
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted">
            {seller ? (
              <>
                <a href={`https://${seller.domain}`} target="_blank" rel="noreferrer" className="hover:underline">{seller.domain}</a>
                {" · "}last {runs.length} scrapes: <span className="text-success">{ok} succeeded</span>,{" "}
                <span className={failed ? "text-danger" : ""}>{failed} failed</span>
              </>
            ) : (
              "Pipeline task"
            )}
          </p>
        </div>
        <AutoRefresh renderedAt={now.toISOString()} />
      </div>

      {seller ? (
        <Card className="p-0">
          <Card.Header className="px-5 pt-5">
            <Card.Title>Scrape history</Card.Title>
            <Card.Description>Each scrape retries up to 3 times; a snapshot with far fewer games than usual is marked suspicious and retried.</Card.Description>
          </Card.Header>
          <Card.Content className="px-2 pb-2">
            {runs.length ? (
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label={`${title} scrape history`} selectionMode="none">
                    <Table.Header>
                      <Table.Column isRowHeader>Started</Table.Column>
                      <Table.Column>Status</Table.Column>
                      <Table.Column className="text-end">Duration</Table.Column>
                      <Table.Column className="text-end">Games seen</Table.Column>
                      <Table.Column className="text-end">Listings loaded</Table.Column>
                      <Table.Column>Attempts</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {runs.map((r) => (
                        <Table.Row key={r.id} id={r.id}>
                          <Table.Cell className="tabular text-sm">
                            {formatDateTime(r.started_at)}
                            <div className="text-xs text-muted">{formatAgo(r.started_at, now)}</div>
                          </Table.Cell>
                          <Table.Cell><StatusChip status={r.status} /></Table.Cell>
                          <Table.Cell className="tabular text-end text-sm">
                            {formatDuration(((r.completed_at ?? now).getTime() - r.started_at.getTime()) / 1000)}
                          </Table.Cell>
                          <Table.Cell className="tabular text-end text-sm">{formatNumber(r.observed_games)}</Table.Cell>
                          <Table.Cell className="tabular text-end text-sm">{formatNumber(r.loaded_listings)}</Table.Cell>
                          <Table.Cell>
                            <ul className="flex flex-col gap-1">
                              {r.attempt_list.map((a) => (
                                <li key={a.no} className="flex items-start gap-2 text-xs">
                                  <span className="tabular shrink-0 pt-0.5 text-muted">#{a.no}</span>
                                  <StatusChip status={a.status} />
                                  {a.error ? (
                                    <span className="line-clamp-2 max-w-md break-all font-mono text-muted" title={a.error}>{a.error}</span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            ) : (
              <p className="p-4 text-sm text-muted">This shop has not been scraped since health tracking started.</p>
            )}
          </Card.Content>
        </Card>
      ) : null}

      <Card>
        <Card.Header>
          <Card.Title>Recent pipeline runs</Card.Title>
          <Card.Description>Progress and the captured log tail of this step in the last {history.length || 10} cycles.</Card.Description>
        </Card.Header>
        <Card.Content>
          {history.length ? (
            <ul className="flex flex-col divide-y divide-border">
              {history.map((h) => (
                <li key={h.id} className="flex flex-col gap-2 py-3 first:pt-0">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <Link href={`/runs/${h.pipeline_run_id}`} className="font-medium hover:text-accent hover:underline">Run #{h.pipeline_run_id}</Link>
                    <StatusChip status={h.status} />
                    <span className="tabular text-xs text-muted">
                      {formatDateTime(h.started_at ?? h.completed_at)}
                      {h.started_at ? ` · ${formatDuration(((h.completed_at ?? now).getTime() - h.started_at.getTime()) / 1000)}` : ""}
                      {h.progress_done !== null ? ` · ${formatNumber(h.progress_done)}${h.progress_total ? ` / ${formatNumber(h.progress_total)}` : ""} items` : ""}
                      {h.exit_code ? ` · exit ${h.exit_code}` : ""}
                    </span>
                  </div>
                  {h.message ? <p className="text-xs text-muted">{h.message}</p> : null}
                  {seller && h.started_at ? (
                    <Link href={`/runs/${h.pipeline_run_id}/prices/${name}`} className="inline-flex w-fit items-center gap-1 text-sm text-accent hover:underline">
                      Price updates from this run <Icon name="chevron" />
                    </Link>
                  ) : null}
                  <StepLog log={h.log_tail} defaultExpanded={h.status === "running"} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No tracked pipeline runs for this step yet.</p>
          )}
        </Card.Content>
      </Card>
    </>
  );
}
