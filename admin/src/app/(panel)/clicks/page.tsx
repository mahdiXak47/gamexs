import { Card, Table } from "@heroui/react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ClientOnly } from "@/components/ClientOnly";
import { formatDateTime, formatOffer, formatToman } from "@/lib/format";
import { RANGES, clickLog, referralsBySeller, type RangeKey } from "@/lib/queries";

export const metadata: Metadata = { title: "Click log" };

type Search = Promise<{ range?: string; seller?: string }>;

/** "Chrome · Android" from a user agent; enough to tell devices apart. */
function device(ua: string | null): string {
  if (!ua) return "—";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Other";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows"
    : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Other";
  return `${browser} · ${os}`;
}

export default async function ClickLogPage({ searchParams }: { searchParams: Search }) {
  await connection();
  const { range: rawRange, seller: rawSeller } = await searchParams;
  const range: RangeKey = rawRange && rawRange in RANGES ? (rawRange as RangeKey) : "week";
  const sellers = await referralsBySeller(range);
  const seller = sellers.find((s) => s.slug === rawSeller) ?? null;
  const rows = await clickLog(range, seller?.slug ?? null);
  const loggedIn = rows.filter((r) => r.user_id).length;
  const href = (next: { range?: RangeKey; seller?: string | null }) => {
    const p = new URLSearchParams();
    const r = next.range ?? range;
    const s = next.seller === undefined ? seller?.slug : next.seller;
    if (r !== "week") p.set("range", r);
    if (s) p.set("seller", s);
    return `/clicks${p.size ? `?${p}` : ""}`;
  };
  const chip = (active: boolean) =>
    `inline-flex min-h-9 items-center rounded-lg px-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
      active ? "bg-surface font-medium text-foreground" : "text-muted hover:bg-surface/60 hover:text-foreground"
    }`;

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Click log</h1>
        <p className="text-sm text-muted">
          Every <bdi lang="fa">«خرید از فروشگاه»</bdi> click: which game and purchase type, when, from which IP and device, and
          whether the visitor was logged in. IPs and devices are kept 90 days. «Logged in» is reported by the visitor&apos;s browser,
          so treat it as analytics, not proof.
        </p>
      </div>

      <nav aria-label="Time range" className="flex flex-wrap gap-1">
        {(Object.keys(RANGES) as RangeKey[]).map((r) => (
          <Link key={r} href={href({ range: r })} aria-current={r === range ? "page" : undefined} className={chip(r === range)}>
            {RANGES[r].label}
          </Link>
        ))}
      </nav>
      <nav aria-label="Shop" className="flex flex-wrap gap-1">
        <Link href={href({ seller: null })} aria-current={!seller ? "page" : undefined} className={chip(!seller)}>All shops</Link>
        {sellers.filter((s) => s.clicks).map((s) => (
          <Link key={s.slug} href={href({ seller: s.slug })} aria-current={s.slug === seller?.slug ? "page" : undefined} className={chip(s.slug === seller?.slug)}>
            {s.name} ({s.clicks})
          </Link>
        ))}
      </nav>

      <Card className="p-0">
        <Card.Header className="px-5 pt-5">
          <Card.Title>{rows.length === 500 ? "Latest 500 clicks" : `${rows.length} clicks`}</Card.Title>
          <Card.Description>{loggedIn} by logged-in visitors · times are Tehran time.</Card.Description>
        </Card.Header>
        <Card.Content className="px-2 pb-2">
          {rows.length ? (
            <ClientOnly>
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="Click log" selectionMode="none">
                    <Table.Header>
                      <Table.Column id="time" isRowHeader>Time</Table.Column>
                      <Table.Column id="game">Game</Table.Column>
                      <Table.Column id="shop">Shop</Table.Column>
                      <Table.Column id="offer">Purchase</Table.Column>
                      <Table.Column id="price" className="text-end">Price</Table.Column>
                      <Table.Column id="user">Visitor</Table.Column>
                      <Table.Column id="ip">IP</Table.Column>
                      <Table.Column id="device">Device</Table.Column>
                      <Table.Column id="from">From page</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {rows.map((r) => (
                        <Table.Row key={r.id} id={r.id}>
                          <Table.Cell className="tabular whitespace-nowrap text-xs">{formatDateTime(r.clicked_at)}</Table.Cell>
                          <Table.Cell>
                            <a href={`https://gamexs.ir/games/${r.game_slug}`} target="_blank" rel="noreferrer" className="font-medium hover:text-accent hover:underline">
                              {r.game_title}
                            </a>
                          </Table.Cell>
                          <Table.Cell className="text-sm">{r.seller_name}</Table.Cell>
                          <Table.Cell className="text-sm">{formatOffer(r.product_type, r.tier)}</Table.Cell>
                          <Table.Cell className="tabular text-end text-sm">{formatToman(r.price_toman ? Number(r.price_toman) : null)}</Table.Cell>
                          <Table.Cell className="text-sm">
                            {r.user_id ? (
                              <span>
                                {r.user_name ?? `User #${r.user_id}`}
                                {r.user_phone ? <span className="tabular block text-xs text-muted">{r.user_phone}</span> : null}
                              </span>
                            ) : (
                              <span className="text-muted">Guest</span>
                            )}
                          </Table.Cell>
                          <Table.Cell className="tabular text-xs">{r.ip_address ?? "—"}</Table.Cell>
                          <Table.Cell className="text-xs text-muted">{device(r.user_agent)}</Table.Cell>
                          <Table.Cell className="max-w-48 truncate text-xs text-muted">{r.referrer ?? "—"}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </ClientOnly>
          ) : (
            <p className="p-4 text-sm text-muted">No clicks in this period. IP, device and login are recorded from today on; older clicks show «—».</p>
          )}
        </Card.Content>
      </Card>
    </>
  );
}
