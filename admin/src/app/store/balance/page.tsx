import { Card, Table } from "@heroui/react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { ClientOnly } from "@/components/ClientOnly";
import { Stat } from "@/components/Stat";
import { requireStore } from "@/lib/auth";
import { formatToman, ledger } from "@/lib/billing";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Balance" };

const KIND: Record<string, string> = { charge: "Invoice", payment: "Payment received", adjustment: "Adjustment", promo_credit: "Promotional credit" };

export default async function StoreBalancePage() {
  await connection();
  const { store } = await requireStore();
  const entries = await ledger(store.id);
  const owed = entries.filter((e) => e.kind !== "promo_credit").reduce((n, e) => n + e.amount_toman, 0);
  const promo = -entries.filter((e) => e.kind === "promo_credit").reduce((n, e) => n + e.amount_toman, 0);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Balance</h1>
        <p className="text-sm text-muted">Every invoice, payment and correction on your account. Promotional credit is listed apart from money you paid.</p>
      </div>
      <section aria-label="Balance" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={owed >= 0 ? "Amount due" : "Credit on account"} value={formatToman(Math.abs(owed))} />
        <Stat label="Promotional credit" value={formatToman(promo)} />
      </section>
      <Card className="p-0">
        <Card.Header className="px-5 pt-5">
          <Card.Title>History</Card.Title>
          <Card.Description>Positive amounts are owed to GameXS; negative amounts are payments or credits.</Card.Description>
        </Card.Header>
        <Card.Content className="px-2 pb-2">
          {entries.length ? (
            <ClientOnly>
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="Account history" selectionMode="none">
                    <Table.Header>
                      <Table.Column id="date" isRowHeader>Date</Table.Column>
                      <Table.Column id="kind">Type</Table.Column>
                      <Table.Column id="note">Details</Table.Column>
                      <Table.Column id="amount" className="text-end">Amount</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {entries.map((e) => (
                        <Table.Row key={e.id} id={String(e.id)}>
                          <Table.Cell className="tabular text-sm">{formatDateTime(e.created_at)}</Table.Cell>
                          <Table.Cell className="text-sm">{KIND[e.kind] ?? e.kind}</Table.Cell>
                          <Table.Cell className="text-sm text-muted">{e.note}{e.period && !e.note.includes(e.period) ? ` (${e.period})` : ""}</Table.Cell>
                          <Table.Cell className="tabular text-end text-sm font-medium">{e.amount_toman < 0 ? "− " : ""}{formatToman(Math.abs(e.amount_toman))}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </ClientOnly>
          ) : (
            <p className="p-4 text-sm text-muted">Nothing yet.</p>
          )}
        </Card.Content>
      </Card>
    </>
  );
}
