import type { NextConfig } from "next";

const disableImageOptimization =
  process.env.NEXT_IMAGE_UNOPTIMIZED === "true" || process.env.NODE_ENV === "development";

const securityHeaders = [
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

const noIndexFollowHeaders = [
  {
    key: "X-Robots-Tag",
    value: "noindex, follow",
  },
];

const noIndexNoFollowHeaders = [
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Let proxy() normalize trailing slashes together with host and legacy slug
  // variants so Google sees one permanent redirect instead of a redirect chain.
  skipTrailingSlashRedirect: true,
  skipProxyUrlNormalize: true,
  experimental: {
    webVitalsAttribution: ["CLS", "LCP", "INP"],
  },
  // undici is imported dynamically in instrumentation.ts to set a global
  // ProxyAgent when HTTPS_PROXY is set. Marking it external prevents
  // Turbopack from trying to bundle it at build time; it's required at
  // runtime from node_modules instead.
  serverExternalPackages: ["undici"],
  // Keep remote hosts allowlisted for images that still need optimization.
  // GameXS S3 media uses RemoteImage, because those objects are already
  // optimized and immutable at the origin.
  images: {
    unoptimized: disableImageOptimization,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "gs3.gamexs.ir",
        port: "",
        pathname: "/gamexs/**",
      },
      {
        protocol: "https",
        hostname: "gs3.gamexs.ir",
        port: "",
        pathname: "/gamexs/**",
      },
      {
        protocol: "https",
        hostname: "images.igdb.com",
        port: "",
        pathname: "/igdb/image/upload/**",
      },
    ],
    formats: ["image/webp"],
    qualities: [50, 75, 90],
    minimumCacheTTL: 86400,
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
        headers: [...publicCatalogCacheHeaders, ...noIndexFollowHeaders],
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
        source: "/account",
        headers: [...privateCacheHeaders, ...noIndexNoFollowHeaders],
      },
      {
        source: "/account/:path*",
        headers: [...privateCacheHeaders, ...noIndexNoFollowHeaders],
      },
      {
        source: "/cart",
        headers: [...privateCacheHeaders, ...noIndexNoFollowHeaders],
      },
      {
        source: "/cart/:path*",
        headers: [...privateCacheHeaders, ...noIndexNoFollowHeaders],
      },
    ];
  },
};

export default nextConfig;
