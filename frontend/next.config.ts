import type { NextConfig } from "next";

// All hostnames that serve cover images scraped from seller sites.
// Add a new entry whenever a new seller's CDN appears in games.cover_url.
const COVER_HOSTS = [
  "dkstatics-public.digikala.com",
  "parsconsole.com",
  "gameplayshop.ir",
  "pspro.ir",
  "www.cdkeyshare.ir",
  "cdkeyshare.ir",
  "xgamesstore.org",
  "nakhlmarket.com",
  "gameonestore.com",
  "cdnfa.com",
  "game-center.ir",
  "yungcenter.com",
  "www.technolife.com",
  "technolife.com",
  "gamario.com",
  "images.igdb.com",
];

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: COVER_HOSTS.map((hostname) => ({ protocol: "https", hostname })),
  },
};

export default nextConfig;
