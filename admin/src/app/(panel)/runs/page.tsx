import { Card, Table } from "@heroui/react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AutoRefresh } from "@/components/AutoRefresh";
import { StatusChip } from "@/components/StatusChip";
import { formatAgo, formatDateTime, formatDuration } from "@/lib/format";
import { listRuns } from "@/lib/queries";

export const metadata: Metadata = { title: "Run history" };

export default async function RunsPage() {
  await connection();
  const now = new Date();
  const runs = await listRuns(50);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Run history</h1>
          <p className="text-sm text-muted">One row per scraper cycle (normally every 24 hours). Open a run for per-step logs.</p>
        </div>
        <AutoRefresh renderedAt={now.toISOString()} />
      </div>
      <Card className="p-0">
        <Card.Content className="p-2">
          {runs.length ? (
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Pipeline runs" selectionMode="none">
                  <Table.Header>
                    <Table.Column isRowHeader>Run</Table.Column>
                    <Table.Column>Status</Table.Column>
                    <Table.Column>Started</Table.Column>
                    <Table.Column className="text-end">Duration</Table.Column>
                    <Table.Column className="text-end">Steps ok / failed / skipped</Table.Column>
                    <Table.Column>Failed steps</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {runs.map((run) => (
                      <Table.Row key={run.id} id={run.id}>
                        <Table.Cell>
                          <Link href={`/runs/${run.id}`} className="font-medium hover:text-accent hover:underline">
                            #{run.id}
                          </Link>
                        </Table.Cell>
                        <Table.Cell><StatusChip status={run.status} /></Table.Cell>
                        <Table.Cell className="tabular text-sm">
                          {formatDateTime(run.started_at)} <span className="text-muted">· {formatAgo(run.started_at, now)}</span>
                        </Table.Cell>
                        <Table.Cell className="tabular text-end text-sm">
                          {formatDuration(((run.completed_at ?? now).getTime() - run.started_at.getTime()) / 1000)}
                          {run.completed_at ? "" : "…"}
                        </Table.Cell>
                        <Table.Cell className="tabular text-end text-sm">
                          <span className="text-success">{run.steps_succeeded}</span> /{" "}
                          <span className={run.steps_failed ? "text-danger" : "text-muted"}>{run.steps_failed}</span> /{" "}
                          <span className="text-muted">{run.steps_skipped}</span>
                          <span className="text-muted"> of {run.steps_total}</span>
                        </Table.Cell>
                        <Table.Cell className="max-w-72 text-xs text-muted">
                          <span className="block truncate" title={run.summary ?? undefined}>{run.summary ?? "—"}</span>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          ) : (
            <p className="p-4 text-sm text-muted">No runs recorded yet.</p>
          )}
        </Card.Content>
      </Card>
    </>
  );
}
