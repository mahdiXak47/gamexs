#!/usr/bin/env node

// Lightweight external uptime check for a cron, GitHub Actions, or Uptime Kuma
// job. It deliberately checks the public HTTP surface only; it does not need
// database credentials. Configure SEO_BASE_URL and override representative
// slugs with SEO_MONITOR_GAME_SLUG / SEO_MONITOR_PUBLISHER_SLUG when catalog
// data differs between environments.

const baseUrl = (process.env.SEO_BASE_URL ?? "https://gamexs.ir").replace(/\/$/, "");
const paths = [
  "/",
  "/robots.txt",
  "/sitemap.xml",
  "/image-sitemap.xml",
  `/games/${process.env.SEO_MONITOR_GAME_SLUG ?? "clair-obscur-expedition-33"}`,
  `/publishers/${process.env.SEO_MONITOR_PUBLISHER_SLUG ?? "sony"}`,
  `/genres/${process.env.SEO_MONITOR_GENRE_SLUG ?? "shooter"}`,
  `/ps-plus/${process.env.SEO_MONITOR_PS_PLUS_TIER ?? "essential"}`,
  `/${process.env.SEO_MONITOR_PURCHASE_TYPE ?? "capacity-2"}`,
];
const timeoutMs = Number(process.env.SEO_MONITOR_TIMEOUT_MS ?? 15000);
const maxLatencyMs = Number(process.env.SEO_MONITOR_MAX_LATENCY_MS ?? 5000);

async function check(path) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "GameXS-SEO-Monitor/1.0" },
    });
    const latencyMs = Math.round(performance.now() - started);
    return { path, status: response.status, latencyMs, ok: response.status >= 200 && response.status < 400 && latencyMs <= maxLatencyMs };
  } catch (error) {
    return { path, status: 0, latencyMs: Math.round(performance.now() - started), ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

const results = await Promise.all(paths.map(check));
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
