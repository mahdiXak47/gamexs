import { Card, Table } from "@heroui/react";
import { ClientOnly } from "@/components/ClientOnly";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ClickBars } from "@/components/ClickBars";
import { Stat } from "@/components/Stat";
import { Icon } from "@/components/Icon";
import { formatAgo, formatDateTime, formatNumber } from "@/lib/format";
import { validityBySeller } from "@/lib/billing";
import { RANGES, referralTrend, referralsByGame, referralsBySeller, type RangeKey } from "@/lib/queries";

export const metadata: Metadata = { title: "Referrals" };

type Search = Promise<{ range?: string; seller?: string }>;

export default async function ReferralsPage({ searchParams }: { searchParams: Search }) {
  await connection();
  const now = new Date();
  const { range: rawRange, seller: rawSeller } = await searchParams;
  const range: RangeKey = rawRange && rawRange in RANGES ? (rawRange as RangeKey) : "month";
  const sellers = await referralsBySeller(range);
  const seller = sellers.find((s) => s.slug === rawSeller) ?? null;
  const [games, trend, validity] = await Promise.all([
    referralsByGame(range, seller?.slug ?? null),
    referralTrend(range, seller?.slug ?? null),
    validityBySeller(range),
  ]);

  const totalClicks = sellers.reduce((n, s) => n + s.clicks, 0);
  const totalUnique = sellers.reduce((n, s) => n + s.unique_visitors, 0);
  const scoped = seller ?? { clicks: totalClicks, unique_visitors: totalUnique };
  const href = (next: { range?: RangeKey; seller?: string | null }) => {
    const p = new URLSearchParams();
    const r = next.range ?? range;
    const s = next.seller === undefined ? seller?.slug : next.seller;
    if (r !== "month") p.set("range", r);
    if (s) p.set("seller", s);
    return `/referrals${p.size ? `?${p}` : ""}`;
  };
  const exportHref = `/referrals/export?${new URLSearchParams({ range, ...(seller ? { seller: seller.slug } : {}) })}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Referrals</h1>
          <p className="text-sm text-muted">
            Customers sent from GameXS to each shop via <bdi lang="fa">«خرید از فروشگاه»</bdi>. Valid is what billing counts (checked before each invoice, see Billing); Not counted is duplicates, suspicious and unverifiable clicks.
          </p>
        </div>
        <a href={exportHref} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-surface px-3 text-sm hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-accent">
          <Icon name="database" /> Export CSV
        </a>
      </div>

      <nav aria-label="Time range" className="flex flex-wrap gap-1">
        {(Object.keys(RANGES) as RangeKey[]).map((r) => (
          <Link
            key={r}
            href={href({ range: r })}
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
        <Stat label={seller ? `Clicks to ${seller.name}` : "Clicks to all shops"} value={formatNumber(scoped.clicks)} />
        <Stat label="Unique visitors" value={formatNumber(scoped.unique_visitors)} />
        <Stat label="Games clicked" value={formatNumber(seller ? seller.games : new Set(games.map((g) => g.slug)).size)} />
        <Stat label="Shops receiving traffic" value={`${sellers.filter((s) => s.clicks).length} / ${sellers.length}`} />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="p-0">
          <Card.Header className="px-5 pt-5">
            <Card.Title>By shop</Card.Title>
            <Card.Description>Select a shop to scope the trend and the games table to it.</Card.Description>
          </Card.Header>
          <Card.Content className="px-2 pb-2">
            <ClientOnly>
<Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Referrals by shop" selectionMode="none">
                  <Table.Header>
                    <Table.Column id="shop" isRowHeader>Shop</Table.Column>
                    <Table.Column id="clicks" className="text-end">Clicks</Table.Column>
                    <Table.Column id="unique" className="text-end">Unique</Table.Column>
                    <Table.Column id="valid" className="text-end">Valid</Table.Column>
                    <Table.Column id="flagged" className="text-end">Not counted</Table.Column>
                    <Table.Column id="share" className="text-end">Share</Table.Column>
                    <Table.Column id="games" className="text-end">Games</Table.Column>
                    <Table.Column id="last-click">Last click</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {sellers.map((s) => (
                      <Table.Row key={s.slug} id={s.slug} className={s.slug === seller?.slug ? "bg-accent/10" : undefined}>
                        <Table.Cell>
                          <Link
                            href={href({ seller: s.slug === seller?.slug ? null : s.slug })}
                            aria-current={s.slug === seller?.slug ? "true" : undefined}
                            className="font-medium hover:text-accent hover:underline"
                          >
                            {s.name}
                          </Link>
                          <div className="text-xs text-muted">{s.domain}</div>
                        </Table.Cell>
                        <Table.Cell className="tabular text-end text-sm font-medium">{formatNumber(s.clicks)}</Table.Cell>
                        <Table.Cell className="tabular text-end text-sm">{formatNumber(s.unique_visitors)}</Table.Cell>
                        <Table.Cell className="tabular text-end text-sm">{formatNumber(validity.get(s.slug)?.valid ?? 0)}</Table.Cell>
                        <Table.Cell className="tabular text-end text-sm text-muted">
                          {formatNumber(((v) => (v ? v.duplicate + v.suspicious + v.invalid + v.unverifiable : 0))(validity.get(s.slug)))}
                        </Table.Cell>
                        <Table.Cell className="tabular text-end text-sm text-muted">
                          {totalClicks ? `${((s.clicks / totalClicks) * 100).toFixed(1)}%` : "—"}
                        </Table.Cell>
                        <Table.Cell className="tabular text-end text-sm">{formatNumber(s.games)}</Table.Cell>
                        <Table.Cell className="tabular text-xs text-muted">
                          <span title={formatDateTime(s.last_click)}>{s.last_click ? formatAgo(s.last_click, now) : "—"}</span>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
</ClientOnly>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Over time · {RANGES[range].label}</Card.Title>
            <Card.Description>
              {seller ? seller.name : "All shops"}, per {RANGES[range].bucket} (Tehran time).
              {seller ? (
                <>
                  {" "}
                  <Link href={href({ seller: null })} className="text-accent hover:underline">Show all shops</Link>
                </>
              ) : null}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <ClickBars buckets={trend} unit={RANGES[range].bucket} />
          </Card.Content>
        </Card>
      </div>

      <Card className="p-0">
        <Card.Header className="px-5 pt-5">
          <Card.Title>By game{seller ? ` · ${seller.name}` : ""}</Card.Title>
          <Card.Description>Most-clicked games in this period{games.length === 200 ? " (top 200)" : ""}.</Card.Description>
        </Card.Header>
        <Card.Content className="px-2 pb-2">
          {games.length ? (
            <ClientOnly>
<Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Referrals by game" selectionMode="none">
                  <Table.Header>
                    <Table.Column id="game" isRowHeader>Game</Table.Column>
                    <Table.Column id="clicks" className="text-end">Clicks</Table.Column>
                    <Table.Column id="unique" className="text-end">Unique</Table.Column>
                    <Table.Column id="shops" className="text-end">Shops</Table.Column>
                    <Table.Column id="last-click">Last click</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {games.map((g) => (
                      <Table.Row key={g.slug} id={g.slug}>
                        <Table.Cell>
                          <a href={`https://gamexs.ir/games/${g.slug}`} target="_blank" rel="noreferrer" className="font-medium hover:text-accent hover:underline">
                            {g.title}
                          </a>
                        </Table.Cell>
                        <Table.Cell className="tabular text-end text-sm font-medium">{formatNumber(g.clicks)}</Table.Cell>
                        <Table.Cell className="tabular text-end text-sm">{formatNumber(g.unique_visitors)}</Table.Cell>
                        <Table.Cell className="tabular text-end text-sm">{formatNumber(g.sellers)}</Table.Cell>
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
            <p className="p-4 text-sm text-muted">No clicks in this period yet. Counting started when the redirect page went live.</p>
          )}
        </Card.Content>
      </Card>
    </>
  );
}

