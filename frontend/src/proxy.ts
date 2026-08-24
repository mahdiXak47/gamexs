import { NextRequest, NextResponse } from "next/server";

// Nonce-based Content Security Policy.
//
// The app previously shipped a static CSP (in next.config.ts) that relied on
// 'unsafe-inline' for its one JS-executing inline script (the Goftino widget
// loader). A strict policy needs a per-request nonce so browsers can run
// framework inline scripts AND our inline loader without 'unsafe-inline'.
//
// Next.js automatically applies the nonce it finds in this CSP header to its
// own framework scripts and to <Script> components carrying a `nonce` prop.
// Pages must be dynamically rendered for the nonce to be injected; any
// statically rendered page would get framework inline scripts blocked, so such
// pages opt into `export const dynamic = "force-dynamic"`.

const apiOrigin = process.env.NEXT_PUBLIC_API_URL
  ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
  : "http://localhost:8000";

const webVitalsEndpointOrigin = process.env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT
  ? new URL(process.env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT).origin
  : null;

// Shared so the layout can build the same connect-src allowlist if needed.
export const SPA_CONNECT_SOURCES = Array.from(
  new Set(
    [
      "'self'",
      apiOrigin,
      webVitalsEndpointOrigin,
      "http://localhost:8000",
      "https://gamexs.ir",
      "https://api.gamexs.ir",
      "https://www.goftino.com",
      "https://*.goftino.com",
      "wss://*.goftino.com",
    ].filter((source): source is string => Boolean(source))
  )
);

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.goftino.com https://*.goftino.com${isDev ? " 'unsafe-eval'" : ""}`,
    `script-src-elem 'self' 'nonce-${nonce}' https://www.goftino.com https://*.goftino.com`,
    // Inline style attributes (React inline styles) must stay allowed; only
    // script execution is made strict. Goftino's stylesheet/chat media are
    // served from its CDN and would otherwise be blocked.
    "style-src 'self' 'unsafe-inline' https://*.goftino.com",
    "img-src 'self' data: blob: http: https:",
    "font-src 'self' data: https://*.goftino.com",
    "media-src 'self' https://*.goftino.com",
    `connect-src ${SPA_CONNECT_SOURCES.join(" ")}`,
    "frame-src https://www.goftino.com https://*.goftino.com https://trustseal.enamad.ir",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ];
  return directives.join("; ").trim();
}

export function proxy(request: NextRequest) {
  const gameSlugMatch = request.nextUrl.pathname.match(/^\/games\/([^/]+)\/?$/);
  if (gameSlugMatch?.[1].includes("_")) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.pathname = `/games/${gameSlugMatch[1].replaceAll("_", "-")}`;
    return NextResponse.redirect(canonicalUrl, 308);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("x-nonce", nonce);
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
