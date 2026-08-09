import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Explicitly named so AI citation crawlers (GPTBot, PerplexityBot, ClaudeBot,
// Google-Extended) are never accidentally caught by a narrower future rule —
// this is a price-comparison site, being cited/quoted by AI answers is a goal,
// not a risk. Only account (auth-gated, no unique public content) and internal
// API routes are excluded.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/account/"],
      },
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "PerplexityBot",
          "ClaudeBot",
          "anthropic-ai",
          "Google-Extended",
          "Bingbot",
        ],
        allow: "/",
        disallow: ["/api/", "/account/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
