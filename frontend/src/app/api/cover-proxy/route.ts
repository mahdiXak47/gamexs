// cover-proxy is no longer used — all covers are served from S3 (gs3.gamexs.ir).
// Kept as a stub so existing bookmarked URLs don't 404.
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set(["images.igdb.com"]);

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) return new NextResponse("Missing url", { status: 400 });

  let parsed: URL;
  try { parsed = new URL(raw); } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return NextResponse.redirect(raw, { status: 302 });
}
