import { requireStaff } from "@/lib/auth";
import { RANGES, referralExport, type RangeKey } from "@/lib/queries";

// CSV of referrals per shop × game × offer for invoicing shops.
export async function GET(request: Request) {
  await requireStaff();
  const params = new URL(request.url).searchParams;
  const range = (params.get("range") ?? "month") in RANGES ? ((params.get("range") ?? "month") as RangeKey) : "month";
  const seller = params.get("seller");
  const rows = await referralExport(range, seller && /^[a-z0-9_-]{1,40}$/.test(seller) ? seller : null);
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    ["seller", "game", "product_type", "tier", "clicks", "unique_visitors", "first_click", "last_click"].join(","),
    ...rows.map((r) =>
      [r.seller, r.game, r.product_type, r.tier, r.clicks, r.unique_visitors, r.first_click.toISOString(), r.last_click.toISOString()].map(cell).join(","),
    ),
  ];
  // BOM so Excel opens Persian shop names as UTF-8.
  return new Response(`﻿${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gamexs-referrals-${seller ?? "all"}-${range}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
