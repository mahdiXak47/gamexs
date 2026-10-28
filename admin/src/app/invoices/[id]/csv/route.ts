import { currentProfile } from "@/lib/auth";
import { invoice as getInvoice, invoiceClicks } from "@/lib/billing";

// Every billed click of one invoice, for staff or the store it belongs to.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const invoice = Number.isSafeInteger(id) ? await getInvoice(id) : null;
  const profile = await currentProfile();
  // Staff see every invoice; a store sees its own once issued. Same answer for
  // "missing" and "not yours", so ids can't be probed.
  const allowed = invoice && profile && (profile.is_staff || (profile.store?.id === invoice.seller_id && invoice.status !== "draft"));
  if (!invoice || !allowed) {
    return new Response("Not found", { status: 404 });
  }
  const rows = await invoiceClicks(invoice.id);
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    ["clicked_at", "game", "product_type", "tier", "line", "amount_toman"].join(","),
    ...rows.map((r) => [r.clicked_at.toISOString(), r.game, r.product_type, r.tier, r.kind, r.amount_toman].map(cell).join(",")),
  ];
  // BOM so Excel opens Persian titles as UTF-8.
  return new Response(`﻿${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gamexs-invoice-${invoice.seller_slug}-${invoice.period}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
