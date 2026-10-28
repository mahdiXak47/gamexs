import { Card, Table } from "@heroui/react";
import { ClientOnly } from "@/components/ClientOnly";
import { Icon } from "@/components/Icon";
import { Stat } from "@/components/Stat";
import { StatusChip } from "@/components/StatusChip";
import { LINE_LABEL, VALIDITY_LABEL, formatToman, type InvoiceLineRow, type InvoiceRow, type Validity } from "@/lib/billing";
import { formatDateTime, formatNumber } from "@/lib/format";

/** One invoice: what was counted, what was free or discounted, what is owed. Used by staff and store pages. */
export function InvoiceView({ invoice, lines }: { invoice: InvoiceRow; lines: InvoiceLineRow[] }) {
  const flagged = Object.entries(invoice.invalid_clicks ?? {}).filter(([, n]) => n > 0);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              Invoice {invoice.period} · {invoice.seller_name}
            </h1>
            <StatusChip status={invoice.status} />
          </div>
          <p className="text-sm text-muted">
            Jalali month {invoice.period}, Tehran time.
            {invoice.issued_at ? ` Issued ${formatDateTime(invoice.issued_at)}.` : " Draft: figures can still change until it is issued."}
            {invoice.paid_at ? ` Paid ${formatDateTime(invoice.paid_at)}.` : ""}
          </p>
        </div>
        <a
          href={`/invoices/${invoice.id}/csv`}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-surface px-3 text-sm hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Icon name="database" /> Download clicks (CSV)
        </a>
      </div>

      <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Amount payable" value={formatToman(invoice.payable_toman)} />
        <Stat label="Valid clicks" value={formatNumber(invoice.valid_clicks)} hint={`${formatNumber(invoice.raw_clicks)} recorded`} />
        <Stat label="Free clicks" value={formatNumber(invoice.free_clicks)} hint="Valid, covered by a promotion" />
        <Stat label="Discounts given" value={formatToman(invoice.per_click_discount_toman + invoice.total_discount_toman)} hint={`Before discounts: ${formatToman(invoice.gross_toman)}`} />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="p-0">
          <Card.Header className="px-5 pt-5">
            <Card.Title>Charges</Card.Title>
            <Card.Description>Clicks priced the same way share a line; each line is rounded once to whole toman.</Card.Description>
          </Card.Header>
          <Card.Content className="px-2 pb-2">
            {lines.length ? (
              <ClientOnly>
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content aria-label="Invoice lines" selectionMode="none">
                      <Table.Header>
                        <Table.Column id="kind" isRowHeader>Line</Table.Column>
                        <Table.Column id="clicks" className="text-end">Clicks</Table.Column>
                        <Table.Column id="rate" className="text-end">Rate / click</Table.Column>
                        <Table.Column id="off" className="text-end">Off</Table.Column>
                        <Table.Column id="gross" className="text-end">Before discount</Table.Column>
                        <Table.Column id="amount" className="text-end">Amount</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {lines.map((l, i) => (
                          <Table.Row key={i} id={String(i)}>
                            <Table.Cell>
                              <span className="font-medium">{LINE_LABEL[l.kind] ?? l.kind}</span>
                              {l.campaign_name ? <div className="text-xs text-muted">{l.campaign_name}</div> : null}
                            </Table.Cell>
                            <Table.Cell className="tabular text-end text-sm">{formatNumber(l.clicks)}</Table.Cell>
                            <Table.Cell className="tabular text-end text-sm">{formatToman(l.base_rate_toman)}</Table.Cell>
                            <Table.Cell className="tabular text-end text-sm">{l.percent_off ? `${l.percent_off}%` : "—"}</Table.Cell>
                            <Table.Cell className="tabular text-end text-sm text-muted">{formatToman(l.gross_toman)}</Table.Cell>
                            <Table.Cell className="tabular text-end text-sm font-medium">{formatToman(l.amount_toman)}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </ClientOnly>
            ) : (
              <p className="p-4 text-sm text-muted">No valid clicks this month, so nothing is charged.</p>
            )}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Summary</Card.Title>
          </Card.Header>
          <Card.Content>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Cost before discounts</dt>
              <dd className="tabular text-end">{formatToman(invoice.gross_toman)}</dd>
              <dt className="text-muted">Per-click discounts</dt>
              <dd className="tabular text-end">− {formatToman(invoice.per_click_discount_toman)}</dd>
              <dt className="text-muted">Invoice discount{invoice.total_campaign_name ? ` (${invoice.total_campaign_name})` : ""}</dt>
              <dd className="tabular text-end">− {formatToman(invoice.total_discount_toman)}</dd>
              <dt className="border-t border-border pt-2 font-medium">Amount payable</dt>
              <dd className="tabular border-t border-border pt-2 text-end font-semibold">{formatToman(invoice.payable_toman)}</dd>
            </dl>
            <h2 className="mt-6 text-sm font-medium">Clicks not charged</h2>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
              {flagged.length ? (
                flagged.map(([validity, n]) => (
                  <div key={validity} className="contents">
                    <dt className="text-muted">{VALIDITY_LABEL[validity as Validity] ?? validity}</dt>
                    <dd className="tabular text-end">{formatNumber(n)}</dd>
                  </div>
                ))
              ) : (
                <dt className="text-muted">None: every recorded click was valid.</dt>
              )}
              {invoice.over_cap_clicks ? (
                <>
                  <dt className="text-muted">Over the monthly spending cap</dt>
                  <dd className="tabular text-end">{formatNumber(invoice.over_cap_clicks)}</dd>
                </>
              ) : null}
            </dl>
          </Card.Content>
        </Card>
      </div>
    </>
  );
}
