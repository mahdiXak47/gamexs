import { Card, Table } from "@heroui/react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ClientOnly } from "@/components/ClientOnly";
import { Stat } from "@/components/Stat";
import { requireStore } from "@/lib/auth";
import { VALIDITY, VALIDITY_LABEL, storeCampaigns, storeGames, storeTraffic } from "@/lib/billing";
import { formatAgo, formatDateTime, formatNumber } from "@/lib/format";
import { RANGES, type RangeKey } from "@/lib/queries";

export const metadata: Metadata = { title: "Traffic" };

export default async function StoreTrafficPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await connection();
  const now = new Date();
  const { store } = await requireStore();
  const { range: raw } = await searchParams;
  const range: RangeKey = raw && raw in RANGES ? (raw as RangeKey) : "month";
  const [traffic, games, campaigns] = await Promise.all([storeTraffic(store.id, range), storeGames(store.id, range), storeCampaigns(store.id)]);
  const notCounted = traffic.duplicate + traffic.suspicious + traffic.invalid + traffic.unverifiable;

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Traffic from GameXS</h1>
        <p className="text-sm text-muted">
          Every visitor GameXS sent to your store. Only valid clicks are billed: repeat clicks by the same person within a short window,
          automated or abnormal traffic, and clicks we cannot verify are recorded here but never charged.
        </p>
      </div>

      <nav aria-label="Time range" className="flex flex-wrap gap-1">
        {(Object.keys(RANGES) as RangeKey[]).map((r) => (
          <Link
            key={r}
            href={r === "month" ? "/store" : `/store?range=${r}`}
            aria-current={r === range ? "page" : undefined}
            className={`inline-flex min-h-9 items-center rounded-lg px-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
              r === range ? "bg-surface font-medium text-foreground" : "text-muted hover:bg-surface/60 hover:text-foreground"
            }`}
          >
            {RANGES[r].label}
          </Link>
        ))}
      </nav>

      <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Clicks recorded" value={formatNumber(traffic.total)} />
        <Stat label="Valid clicks" value={formatNumber(traffic.valid)} hint="Counted for billing" />
        <Stat label="Not counted" value={formatNumber(notCounted)} hint="Duplicate, suspicious or unverifiable" />
        <Stat label="Not yet checked" value={formatNumber(traffic.pending)} hint="Checked before each invoice" />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="p-0">
          <Card.Header className="px-5 pt-5">
            <Card.Title>By game</Card.Title>
            <Card.Description>Games customers clicked through to your store{games.length === 100 ? " (top 100)" : ""}.</Card.Description>
          </Card.Header>
          <Card.Content className="px-2 pb-2">
            {games.length ? (
              <ClientOnly>
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content aria-label="Clicks by game" selectionMode="none">
                      <Table.Header>
                        <Table.Column id="game" isRowHeader>Game</Table.Column>
                        <Table.Column id="clicks" className="text-end">Clicks</Table.Column>
                        <Table.Column id="valid" className="text-end">Valid</Table.Column>
                        <Table.Column id="last">Last click</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {games.map((g) => (
                          <Table.Row key={g.slug} id={g.slug}>
                            <Table.Cell>
                              <a href={`https://gamexs.ir/games/${g.slug}`} target="_blank" rel="noreferrer" className="font-medium hover:text-accent hover:underline">
                                {g.title}
                              </a>
                            </Table.Cell>
                            <Table.Cell className="tabular text-end text-sm">{formatNumber(g.clicks)}</Table.Cell>
                            <Table.Cell className="tabular text-end text-sm font-medium">{formatNumber(g.valid)}</Table.Cell>
                            <Table.Cell className="tabular text-xs text-muted">
                              <span title={formatDateTime(g.last_click)}>{formatAgo(g.last_click, now)}</span>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </ClientOnly>
            ) : (
              <p className="p-4 text-sm text-muted">No clicks in this period yet.</p>
            )}
          </Card.Content>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <Card.Header>
              <Card.Title>Click checks</Card.Title>
              <Card.Description>How this period&apos;s clicks were classified.</Card.Description>
            </Card.Header>
            <Card.Content>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                {VALIDITY.map((v) => (
                  <div key={v} className="contents">
                    <dt className="text-muted">{VALIDITY_LABEL[v]}</dt>
                    <dd className="tabular text-end">{formatNumber(traffic[v])}</dd>
                  </div>
                ))}
              </dl>
            </Card.Content>
          </Card>
          <Card>
            <Card.Header>
              <Card.Title>Your promotions</Card.Title>
            </Card.Header>
            <Card.Content>
              {campaigns.length ? (
                <ul className="flex flex-col gap-3 text-sm">
                  {campaigns.map((c, i) => (
                    <li key={i}>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-muted">
                        {c.percent === 100 ? "Free" : `${c.percent}% off`} {c.method === "total" ? "on each invoice" : "per click"}
                        {c.click_allowance !== null ? ` · ${formatNumber(c.used_clicks)} of ${formatNumber(c.click_allowance)} clicks used` : ""}
                        {c.ends_at ? ` · until ${formatDateTime(c.ends_at)}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No active promotion.</p>
              )}
            </Card.Content>
          </Card>
        </div>
      </div>
    </>
  );
}
