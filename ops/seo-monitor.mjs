#!/usr/bin/env node

// Lightweight external uptime check for a cron, GitHub Actions, or Uptime Kuma
// job. It deliberately checks the public HTTP surface only; it does not need
// database credentials. Configure SEO_BASE_URL and override representative
// slugs with SEO_MONITOR_GAME_SLUG / SEO_MONITOR_PUBLISHER_SLUG when catalog
// data differs between environments.

const baseUrl = (process.env.SEO_BASE_URL ?? "https://gamexs.ir").replace(/\/$/, "");
const timeoutMs = Number(process.env.SEO_MONITOR_TIMEOUT_MS ?? 15000);
const maxLatencyMs = Number(process.env.SEO_MONITOR_MAX_LATENCY_MS ?? 5000);
const requestedConcurrency = Number(process.env.SEO_MONITOR_CONCURRENCY ?? 2);
const concurrency = Number.isSafeInteger(requestedConcurrency) && requestedConcurrency > 0
  ? requestedConcurrency
  : 2;

async function check(path, { captureBody = false } = {}) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "GameXS-SEO-Monitor/1.0" },
    });
    const body = await response.text();
    const latencyMs = Math.round(performance.now() - started);
    const streamedNotFound = response.status === 200 && (
      /<title[^>]*>\s*صفحه پیدا نشد(?:\s*\||\s*<)/i.test(body) ||
      body.includes("NEXT_HTTP_ERROR_FALLBACK;404")
    );
    const streamedServerError = response.status === 200 && (
      body.includes("مشکلی در نمایش این صفحه پیش آمد") ||
      body.includes("NEXT_HTTP_ERROR_FALLBACK;500")
    );
    const noindexResponse = response.headers.get("x-robots-tag")?.toLowerCase().includes("noindex") ||
      /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(body);
    const error = streamedNotFound
      ? "not-found document returned with HTTP 200"
      : streamedServerError
        ? "server-error document returned with HTTP 200"
        : noindexResponse
          ? "noindex response on monitored route"
          : undefined;
    return {
      result: {
        path,
        status: response.status,
        latencyMs,
        ok: response.status >= 200 && response.status < 400 && latencyMs <= maxLatencyMs && !error,
        ...(error ? { error } : {}),
      },
      ...(captureBody ? { body } : {}),
    };
  } catch (error) {
    return {
      result: {
        path,
        status: 0,
        latencyMs: Math.round(performance.now() - started),
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      ...(captureBody ? { body: "" } : {}),
    };
  } finally {
    clearTimeout(timer);
  }
}

function routeFromSitemap(body, prefix) {
  for (const [, rawUrl] of body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
    try {
      const pathname = new URL(rawUrl.trim()).pathname;
      if (pathname.startsWith(prefix)) return pathname;
    } catch {
      // Ignore malformed sitemap entries and keep looking for a usable route.
    }
  }
  return null;
}

function monitoredPath(body, envName, prefix, fallbackPath, sitemapPrefix = prefix) {
  const override = process.env[envName]?.trim();
  if (override) return override.startsWith("/") ? override : `${prefix}${override}`;
  return routeFromSitemap(body, sitemapPrefix) ?? fallbackPath;
}

async function mapWithConcurrency(items, limit, mapper) {
  const output = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      output[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

// Probe the sitemap first so representative catalog routes come from the
// routes this deployment actually publishes (not stale hard-coded slugs).
const sitemapCheck = await check("/sitemap.xml", { captureBody: true });
const sitemapBody = sitemapCheck.body ?? "";
const paths = [
  "/",
  "/robots.txt",
  "/sitemap.xml",
  "/image-sitemap.xml",
  monitoredPath(sitemapBody, "SEO_MONITOR_GAME_SLUG", "/games/", "/games/clair-obscur-expedition-33"),
  monitoredPath(sitemapBody, "SEO_MONITOR_PUBLISHER_SLUG", "/publishers/", "/publishers/sony"),
  monitoredPath(sitemapBody, "SEO_MONITOR_GENRE_SLUG", "/genres/", "/genres/shooter"),
  monitoredPath(sitemapBody, "SEO_MONITOR_PS_PLUS_TIER", "/ps-plus/", "/ps-plus/essential"),
  monitoredPath(sitemapBody, "SEO_MONITOR_PURCHASE_TYPE", "/", "/capacity-2", "/capacity-"),
];
const otherChecks = await mapWithConcurrency(
  paths.map((path, index) => ({ path, index })).filter(({ index }) => index !== 2),
  concurrency,
  ({ path }) => check(path),
);
let otherCheckIndex = 0;
const results = paths.map((_, index) => index === 2
  ? sitemapCheck.result
  : otherChecks[otherCheckIndex++].result
);
const failures = results.filter((result) => !result.ok);
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), baseUrl, results, failures }, null, 2));

if (failures.length && process.env.SEO_ALERT_WEBHOOK) {
  await fetch(process.env.SEO_ALERT_WEBHOOK, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: `GameXS SEO monitor: ${failures.length} check(s) failed`, baseUrl, failures }),
  }).catch(() => {});
}

process.exitCode = failures.length ? 1 : 0;
