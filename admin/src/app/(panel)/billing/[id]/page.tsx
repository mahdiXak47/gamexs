import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { InvoiceView } from "@/components/InvoiceView";
import { invoice as getInvoice, invoiceLines } from "@/lib/billing";

export const metadata: Metadata = { title: "Invoice" };

export default async function StaffInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  const invoice = Number.isSafeInteger(id) ? await getInvoice(id) : null;
  if (!invoice) notFound();
  return (
    <>
      <Link href={`/billing?period=${invoice.period}`} className="text-sm text-accent hover:underline">← Billing {invoice.period}</Link>
      <InvoiceView invoice={invoice} lines={await invoiceLines(invoice.id)} />
    </>
  );
}
