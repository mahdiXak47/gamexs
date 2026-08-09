import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// Self-hosted Core Web Vitals sink. The browser reports metrics (via beacon
// or keepalive fetch from WebVitalsReporter) to NEXT_PUBLIC_WEB_VITALS_ENDPOINT,
// which defaults to this route. Rows land in the shared `web_vitals` table.
//
// Failure here is diagnostic-only by design: it must never affect page UX, so
// we never throw to the caller — just ack.

const METRIC_NAMES = new Set(["CLS", "FCP", "INP", "LCP", "TTFB"]);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { id, name, value, delta, rating, navigationType, path } = body;

    if (typeof name !== "string" || !METRIC_NAMES.has(name)) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (
      typeof id !== "string" ||
      typeof value !== "number" ||
      !Number.isFinite(value)
    ) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    await query(
      `INSERT INTO web_vitals
         (metric_id, name, value, delta, rating, navigation_type, path)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        name,
        value,
        typeof delta === "number" ? delta : null,
        typeof rating === "string" ? rating : null,
        typeof navigationType === "string" ? navigationType : null,
        typeof path === "string" ? path.slice(0, 2000) : null,
      ]
    );

    return NextResponse.json({ ok: true });
  } catch {
    // Dropping metrics is acceptable; never surface an error to the client.
    return NextResponse.json({ ok: true });
  }
}
