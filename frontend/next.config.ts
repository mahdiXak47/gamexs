import type { NextConfig } from "next";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL
  ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
  : "http://localhost:8000";

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
      [
        "connect-src 'self'",
        apiOrigin,
        "http://localhost:8000",
        "https://gamexs.ir",
        "https://api.gamexs.ir",
        "https://www.goftino.com",
        "https://*.goftino.com",
        "wss://*.goftino.com",
      ].join(" "),
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
    ];
  },
};

export default nextConfig;
