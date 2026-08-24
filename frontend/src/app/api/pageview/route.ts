import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { path?: unknown };
    const path = typeof body.path === "string" ? body.path : "";
    if (!path.startsWith("/") || path.startsWith("//") || path.length > 500 || path.startsWith("/api/")) {
      return NextResponse.json({ ok: true, ignored: true });
    }
    await query("INSERT INTO site_page_views (path) VALUES ($1)", [path]);
  } catch {
    // Analytics is diagnostic-only and must never affect page UX.
  }
  return NextResponse.json({ ok: true });
}
