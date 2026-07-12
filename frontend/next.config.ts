import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Cover images come from external CDNs already sized for display
  // (IGDB t_cover_big = 264×374px; seller thumbnails are similarly bounded).
  // unoptimized=true lets the browser fetch them directly, which avoids
  // the Next.js server needing outbound HTTPS to each CDN — critical in
  // environments where those CDNs require a proxy (local dev in Iran).
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
