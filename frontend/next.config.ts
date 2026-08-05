import type { NextConfig } from "next";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL
  ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
  : "http://localhost:8000";

const connectSources = Array.from(new Set([
  "'self'",
  apiOrigin,
  "http://localhost:8000",
  "https://gamexs.ir",
  "https://api.gamexs.ir",
  "https://www.goftino.com",
  "https://*.goftino.com",
  "wss://*.goftino.com",
]));

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' https://www.goftino.com",
      "script-src-elem 'self' 'unsafe-inline' https://www.goftino.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: http: https:",
      "font-src 'self' data:",
      `connect-src ${connectSources.join(" ")}`,
      "frame-src https://www.goftino.com https://*.goftino.com https://trustseal.enamad.ir",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join("; "),
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const publicCatalogCacheHeaders = [
  {
    key: "Cache-Control",
    value: "public, max-age=0, s-maxage=300, stale-while-revalidate=1800",
  },
];

const staticPageCacheHeaders = [
  {
    key: "Cache-Control",
    value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  },
];

const privateCacheHeaders = [
  {
    key: "Cache-Control",
    value: "private, no-store",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // undici is imported dynamically in instrumentation.ts to set a global
  // ProxyAgent when HTTPS_PROXY is set. Marking it external prevents
  // Turbopack from trying to bundle it at build time; it's required at
  // runtime from node_modules instead.
  serverExternalPackages: ["undici"],
  // Cover images come from external CDNs already sized for display
  // (IGDB t_cover_big = 264×374px; seller thumbnails are similarly bounded).
  // unoptimized=true lets the browser fetch them directly, which avoids
  // the Next.js server needing outbound HTTPS to each CDN — critical in
  // environments where those CDNs require a proxy (local dev in Iran).
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/",
        headers: publicCatalogCacheHeaders,
      },
      {
        source: "/games/:slug",
        headers: publicCatalogCacheHeaders,
      },
      {
        source: "/genres/:slug",
        headers: publicCatalogCacheHeaders,
      },
      {
        source: "/publishers/:slug",
        headers: publicCatalogCacheHeaders,
      },
      {
        source: "/search",
        headers: publicCatalogCacheHeaders,
      },
      {
        source: "/upcoming",
        headers: publicCatalogCacheHeaders,
      },
      {
        source: "/ps-plus",
        headers: publicCatalogCacheHeaders,
      },
      {
        source: "/ps-plus/:tier",
        headers: publicCatalogCacheHeaders,
      },
      {
        source: "/account-games",
        headers: publicCatalogCacheHeaders,
      },
      {
        source: "/disc-games",
        headers: publicCatalogCacheHeaders,
      },
      {
        source: "/own-account-games",
        headers: publicCatalogCacheHeaders,
      },
      {
        source: "/capacity-:tier(1|2|3)",
        headers: publicCatalogCacheHeaders,
      },
      {
        source: "/about",
        headers: staticPageCacheHeaders,
      },
      {
        source: "/contact",
        headers: staticPageCacheHeaders,
      },
      {
        source: "/privacy",
        headers: staticPageCacheHeaders,
      },
      {
        source: "/terms",
        headers: staticPageCacheHeaders,
      },
      {
        source: "/account/:path*",
        headers: privateCacheHeaders,
      },
      {
        source: "/cart/:path*",
        headers: privateCacheHeaders,
      },
    ];
  },
};

export default nextConfig;
