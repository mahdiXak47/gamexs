import { Card, Table } from "@heroui/react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ClientOnly } from "@/components/ClientOnly";
import { StatusChip } from "@/components/StatusChip";
import { requireStore } from "@/lib/auth";
import { formatToman, invoices } from "@/lib/billing";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Invoices" };

export default async function StoreInvoicesPage() {
  await connection();
  const { store } = await requireStore();
  const rows = await invoices(null, store.id);
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="text-sm text-muted">One invoice per Jalali month for the valid clicks GameXS sent you, after promotions and discounts.</p>
      </div>
      <Card className="p-0">
        <Card.Content className="px-2 py-2">
          {rows.length ? (
            <ClientOnly>
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="Invoices" selectionMode="none">
                    <Table.Header>
                      <Table.Column id="period" isRowHeader>Month</Table.Column>
                      <Table.Column id="status">Status</Table.Column>
                      <Table.Column id="valid" className="text-end">Valid clicks</Table.Column>
                      <Table.Column id="free" className="text-end">Free</Table.Column>
                      <Table.Column id="discount" className="text-end">You saved</Table.Column>
                      <Table.Column id="payable" className="text-end">Payable</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {rows.map((r) => (
                        <Table.Row key={r.id} id={String(r.id)}>
                          <Table.Cell>
                            <Link href={`/store/invoices/${r.id}`} className="tabular font-medium hover:text-accent hover:underline">{r.period}</Link>
                          </Table.Cell>
                          <Table.Cell><StatusChip status={r.status} /></Table.Cell>
                          <Table.Cell className="tabular text-end text-sm">{formatNumber(r.valid_clicks)}</Table.Cell>
                          <Table.Cell className="tabular text-end text-sm">{formatNumber(r.free_clicks)}</Table.Cell>
                          <Table.Cell className="tabular text-end text-sm">{formatToman(r.per_click_discount_toman + r.total_discount_toman)}</Table.Cell>
                          <Table.Cell className="tabular text-end text-sm font-medium">{formatToman(r.payable_toman)}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </ClientOnly>
          ) : (
            <p className="p-4 text-sm text-muted">No invoices yet. Your first one appears after the end of your first billed month.</p>
          )}
        </Card.Content>
      </Card>
    </>
  );
}
