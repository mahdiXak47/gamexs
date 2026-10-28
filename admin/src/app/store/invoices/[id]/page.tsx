import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { InvoiceView } from "@/components/InvoiceView";
import { requireStore } from "@/lib/auth";
import { invoice as getInvoice, invoiceLines } from "@/lib/billing";

export const metadata: Metadata = { title: "Invoice" };

export default async function StoreInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { store } = await requireStore();
  const id = Number((await params).id);
  const invoice = Number.isSafeInteger(id) ? await getInvoice(id) : null;
  // Another store's invoice, or a draft, looks exactly like a missing one.
  if (!invoice || invoice.seller_id !== store.id || invoice.status === "draft") notFound();
  return (
    <>
      <Link href="/store/invoices" className="text-sm text-accent hover:underline">← All invoices</Link>
      <InvoiceView invoice={invoice} lines={await invoiceLines(invoice.id)} />
    </>
  );
}
