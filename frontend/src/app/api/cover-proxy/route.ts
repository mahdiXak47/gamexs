import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set(["images.igdb.com"]);

// Redirect to the CDN directly — the browser fetches the image, not this
// server. This avoids requiring the k8s pod to have outbound HTTPS access
// to every image CDN, which isn't guaranteed in all hosting environments.
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) return new NextResponse("Missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return NextResponse.redirect(raw, {
    status: 301,
    headers: {
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
