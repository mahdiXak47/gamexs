import { Card, Table } from "@heroui/react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ClientOnly } from "@/components/ClientOnly";
import { Icon } from "@/components/Icon";
import { Stat } from "@/components/Stat";
import { StatusChip } from "@/components/StatusChip";
import { billingPeriods, formatToman, invoices } from "@/lib/billing";
import { formatNumber } from "@/lib/format";
import { API_URL } from "@/lib/session";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await connection();
  const periods = await billingPeriods();
  const { period: raw } = await searchParams;
  const period = raw && periods.includes(raw) ? raw : (periods[0] ?? null);
  const rows = period ? await invoices(period) : [];
  const live = rows.filter((r) => r.status !== "void");
  const sum = (pick: (r: (typeof rows)[number]) => number) => live.reduce((n, r) => n + pick(r), 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="text-sm text-muted">
            Monthly CPC invoices per store (Jalali month). Draft, issue, record payments and edit rates or promotions in Django admin.
          </p>
        </div>
        <a
          href={`${API_URL}/admin/billing/invoice/`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-surface px-3 text-sm hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Icon name="tag" /> Manage in Django admin
        </a>
      </div>

      {periods.length ? (
        <nav aria-label="Billing month" className="flex flex-wrap gap-1">
          {periods.map((p) => (
            <Link
              key={p}
              href={`/billing?period=${p}`}
              aria-current={p === period ? "page" : undefined}
              className={`tabular inline-flex min-h-9 items-center rounded-lg px-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
                p === period ? "bg-surface font-medium text-foreground" : "text-muted hover:bg-surface/60 hover:text-foreground"
              }`}
            >
              {p}
            </Link>
          ))}
        </nav>
      ) : null}

      <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Payable this month" value={formatToman(sum((r) => r.payable_toman))} hint={`${live.length} invoice(s), void excluded`} />
        <Stat label="Valid clicks" value={formatNumber(sum((r) => r.valid_clicks))} hint={`${formatNumber(sum((r) => r.raw_clicks))} recorded`} />
        <Stat label="Free clicks given" value={formatNumber(sum((r) => r.free_clicks))} />
        <Stat label="Discount value granted" value={formatToman(sum((r) => r.per_click_discount_toman + r.total_discount_toman))} />
      </section>

      <Card className="p-0">
        <Card.Header className="px-5 pt-5">
          <Card.Title>Invoices{period ? ` · ${period}` : ""}</Card.Title>
          <Card.Description>Select a store to see its lines and download its clicks.</Card.Description>
        </Card.Header>
        <Card.Content className="px-2 pb-2">
          {rows.length ? (
            <ClientOnly>
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="Invoices" selectionMode="none">
                    <Table.Header>
                      <Table.Column id="store" isRowHeader>Store</Table.Column>
                      <Table.Column id="status">Status</Table.Column>
                      <Table.Column id="valid" className="text-end">Valid</Table.Column>
                      <Table.Column id="free" className="text-end">Free</Table.Column>
                      <Table.Column id="discounted" className="text-end">Discounted</Table.Column>
                      <Table.Column id="charged" className="text-end">Charged</Table.Column>
                      <Table.Column id="payable" className="text-end">Payable</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {rows.map((r) => (
                        <Table.Row key={r.id} id={String(r.id)}>
                          <Table.Cell>
                            <Link href={`/billing/${r.id}`} className="font-medium hover:text-accent hover:underline">{r.seller_name}</Link>
                          </Table.Cell>
                          <Table.Cell><StatusChip status={r.status} /></Table.Cell>
                          <Table.Cell className="tabular text-end text-sm">{formatNumber(r.valid_clicks)}</Table.Cell>
                          <Table.Cell className="tabular text-end text-sm">{formatNumber(r.free_clicks)}</Table.Cell>
                          <Table.Cell className="tabular text-end text-sm">{formatNumber(r.discounted_clicks)}</Table.Cell>
                          <Table.Cell className="tabular text-end text-sm">{formatNumber(r.billable_clicks - r.discounted_clicks)}</Table.Cell>
                          <Table.Cell className="tabular text-end text-sm font-medium">{formatToman(r.payable_toman)}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </ClientOnly>
          ) : (
            <p className="p-4 text-sm text-muted">
              No invoices yet. In Django admin, open Invoices and choose “Draft invoices for a month”, or run{" "}
              <code className="text-xs">manage.py billing_draft</code>.
            </p>
          )}
        </Card.Content>
      </Card>
    </>
  );
}
