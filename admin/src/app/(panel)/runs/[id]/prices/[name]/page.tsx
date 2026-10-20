import { Card, Input, Label, Table, TextField } from "@heroui/react";
import { ClientOnly } from "@/components/ClientOnly";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Icon } from "@/components/Icon";
import { StatusChip } from "@/components/StatusChip";
import { formatDateTime, formatNumber, formatOffer, formatToman } from "@/lib/format";
import { getStep, sellerExists, stepPriceUpdates, type PriceUpdate } from "@/lib/queries";

const VIEWS = {
  all: "All",
  changed: "Price changed",
  new: "New listings",
  out: "Out of stock",
} as const;
type View = keyof typeof VIEWS;
const MAX_ROWS = 1000;

type Params = Promise<{ id: string; name: string }>;
type Search = Promise<{ view?: string; q?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, name } = await params;
  return { title: `${name} price updates · run #${id}` };
}

const changeOf = (u: PriceUpdate) => (u.prev_price !== null && u.prev_price !== u.price ? u.price - u.prev_price : 0);

function matches(u: PriceUpdate, view: View) {
  if (view === "changed") return changeOf(u) !== 0 || (u.prev_in_stock !== null && u.prev_in_stock !== u.in_stock);
  if (view === "new") return u.prev_price === null;
  if (view === "out") return !u.in_stock;
  return true;
}

export default async function PriceUpdatesPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  await connection();
  const [{ id, name }, { view: rawView, q }] = await Promise.all([params, searchParams]);
  const [step, seller] = await Promise.all([getStep(id, name), sellerExists(name)]);
  if (!step || !seller || !step.started_at) notFound();

  const updates = await stepPriceUpdates(name, step.started_at, step.completed_at);
  const view: View = rawView && rawView in VIEWS ? (rawView as View) : "all";
  const needle = q?.trim().toLowerCase() ?? "";
  const filtered = updates.filter((u) => matches(u, view) && (!needle || u.title.toLowerCase().includes(needle)));
  const shown = filtered.slice(0, MAX_ROWS);

  const counts = {
    all: updates.length,
    changed: updates.filter((u) => matches(u, "changed")).length,
    new: updates.filter((u) => matches(u, "new")).length,
    out: updates.filter((u) => matches(u, "out")).length,
  };
  const up = updates.filter((u) => changeOf(u) > 0).length;
  const down = updates.filter((u) => changeOf(u) < 0).length;
  const games = new Set(updates.map((u) => u.slug)).size;
  const href = (v: View) => `?${new URLSearchParams({ ...(v !== "all" ? { view: v } : {}), ...(needle ? { q: needle } : {}) })}`;

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/runs" className="hover:text-foreground hover:underline">Run history</Link>
        {" / "}
        <Link href={`/runs/${id}`} className="hover:text-foreground hover:underline">#{id}</Link>
        {" / "}
        {seller.name} prices
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{seller.name} · price updates</h1>
          <StatusChip status={step.status} size="md" />
          <span className="text-sm text-muted">
            {formatDateTime(step.started_at)} → {step.completed_at ? formatDateTime(step.completed_at) : "now"}
          </span>
        </div>
        {step.status === "running" ? <AutoRefresh renderedAt={new Date().toISOString()} /> : null}
      </div>

      <section aria-label="Summary" className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Summary label="Listings updated" value={formatNumber(counts.all)} hint={`${formatNumber(games)} games`} />
        <Summary label="Price changed" value={formatNumber(counts.changed)} />
        <Summary label="Went up" value={formatNumber(up)} tone="danger" icon="up" />
        <Summary label="Went down" value={formatNumber(down)} tone="success" icon="down" />
        <Summary label="New listings" value={formatNumber(counts.new)} hint={`${formatNumber(counts.out)} out of stock`} />
      </section>

      <Card className="p-0">
        <Card.Header className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-end sm:justify-between">
          <nav aria-label="Filter" className="flex flex-wrap gap-1">
            {(Object.keys(VIEWS) as View[]).map((v) => (
              <Link
                key={v}
                href={href(v)}
                aria-current={v === view ? "page" : undefined}
                className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
                  v === view ? "bg-surface-secondary font-medium text-foreground" : "text-muted hover:bg-surface-secondary/60 hover:text-foreground"
                }`}
              >
                {VIEWS[v]}
                <span className="tabular text-xs text-muted">{formatNumber(counts[v])}</span>
              </Link>
            ))}
          </nav>
          <form method="get" className="flex items-end gap-2" role="search">
            {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
            <TextField name="q" defaultValue={needle} variant="secondary" aria-label="Search game title">
              <Label className="sr-only">Search game title</Label>
              <Input placeholder="Search game…" className="w-56" />
            </TextField>
          </form>
        </Card.Header>
        <Card.Content className="px-2 pb-2">
          {shown.length ? (
            <ClientOnly>
<Table>
              <Table.ScrollContainer>
                <Table.Content aria-label={`${seller.name} price updates`} selectionMode="none">
                  <Table.Header>
                    <Table.Column id="game" isRowHeader>Game</Table.Column>
                    <Table.Column id="offer">Offer</Table.Column>
                    <Table.Column id="price" className="text-end">Price</Table.Column>
                    <Table.Column id="previous" className="text-end">Previous</Table.Column>
                    <Table.Column id="change" className="text-end">Change</Table.Column>
                    <Table.Column id="stock">Stock</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {shown.map((u) => (
                      <Table.Row key={u.listing_id} id={u.listing_id}>
                        <Table.Cell>
                          <a href={`https://gamexs.ir/games/${u.slug}`} target="_blank" rel="noreferrer" className="font-medium hover:text-accent hover:underline">
                            {u.title}
                          </a>
                          <a href={u.source_url} target="_blank" rel="noreferrer" className="block max-w-72 truncate text-xs text-muted hover:underline">
                            {decodeURI(u.source_url)}
                          </a>
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap text-sm">{formatOffer(u.product_type, u.tier)}</Table.Cell>
                        <Table.Cell className="tabular whitespace-nowrap text-end text-sm font-medium">{formatToman(u.price)}</Table.Cell>
                        <Table.Cell className="tabular whitespace-nowrap text-end text-sm text-muted">{formatToman(u.prev_price)}</Table.Cell>
                        <Table.Cell className="tabular whitespace-nowrap text-end text-sm">
                          <Change update={u} />
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap text-xs">
                          {u.in_stock ? <span className="text-success">In stock</span> : <span className="text-muted">Out of stock</span>}
                          {u.prev_in_stock !== null && u.prev_in_stock !== u.in_stock ? (
                            <span className="text-muted"> (was {u.prev_in_stock ? "in" : "out"})</span>
                          ) : null}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
</ClientOnly>
          ) : (
            <p className="p-4 text-sm text-muted">
              {updates.length ? "No listings match this filter." : step.status === "running" ? "Prices are written when the crawl finishes and the load step runs." : "This step wrote no prices."}
            </p>
          )}
          {filtered.length > MAX_ROWS ? (
            <p className="px-3 py-2 text-xs text-muted">Showing the first {MAX_ROWS} of {formatNumber(filtered.length)} — narrow it with the filters or search.</p>
          ) : null}
        </Card.Content>
      </Card>
    </>
  );
}

function Change({ update }: { update: PriceUpdate }) {
  if (update.prev_price === null) return <span className="text-accent">new</span>;
  const delta = changeOf(update);
  if (!delta) return <span className="text-muted">—</span>;
  const pct = update.prev_price ? (delta / update.prev_price) * 100 : 0;
  const up = delta > 0;
  return (
    <span className={`inline-flex items-center justify-end gap-1 ${up ? "text-danger" : "text-success"}`} title={`${up ? "+" : ""}${formatToman(delta)}`}>
      <Icon name={up ? "up" : "down"} className="h-3.5 w-3.5" />
      {up ? "+" : "−"}
      {Math.abs(pct) >= 10 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)}%
      <span className="text-xs text-muted">({up ? "+" : "−"}{formatNumber(Math.abs(delta))})</span>
    </span>
  );
}

function Summary({ label, value, hint, tone, icon }: { label: string; value: string; hint?: string; tone?: "success" | "danger"; icon?: "up" | "down" }) {
  return (
    <Card className="gap-1 p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`tabular inline-flex items-center gap-1.5 text-lg font-semibold ${tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : ""}`}>
        {icon ? <Icon name={icon} className="h-4 w-4" /> : null}
        {value}
      </p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}
