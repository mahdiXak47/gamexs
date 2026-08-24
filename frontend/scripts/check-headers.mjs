#!/usr/bin/env node
// Runtime header checks against a production build.
//
// Usage (from frontend/):
//   npm run build && npm run test:headers
//
// Starts `next start` on a scratch port, then asserts cache + security headers
// on representative routes. Exits non-zero on any failure so it can gate CI.

import { spawn } from "node:child_process";
import process from "node:process";

const PORT = process.env.TEST_PORT ?? "3010";
const BASE = `http://localhost:${PORT}`;
const READY_TIMEOUT_MS = 90_000;

const failures = [];
const child = spawn(
  "node_modules/.bin/next",
  ["start", "-H", "127.0.0.1", "-p", PORT],
  {
    env: { ...process.env, PORT },
    stdio: ["ignore", "pipe", "pipe"],
  }
);

function logServer(chunk) {
  process.stderr.write(`[next] ${chunk}`);
}

child.stdout.on("data", logServer);
child.stderr.on("data", logServer);

async function waitForReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`next start exited early with code ${child.exitCode}`);
    }
    try {
      const res = await fetch(`${BASE}/api/search?q=ab`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Timed out waiting for next start");
}

function assertHeader(route, res, name, expected, { exact = false } = {}) {
  const value = res.headers.get(name);
  const ok = value !== null && (exact ? value === expected : value.includes(expected));
  if (!ok) {
    failures.push(
      `${route}: expected header ${name} to ${exact ? "equal" : "include"} "${expected}" but got ${JSON.stringify(value)}`
    );
  } else {
    console.log(`ok   ${route} -> ${name}: ${exact ? value : expected}${exact ? "" : " (matched)"}`);
  }
}

function assertNoHeader(route, res, name) {
  if (res.headers.get(name) !== null) {
    failures.push(`${route}: expected NO ${name} header but got ${JSON.stringify(res.headers.get(name))}`);
  } else {
    console.log(`ok   ${route} -> no ${name} header`);
  }
}

function assertStatus(route, res, expected) {
  if (res.status !== expected) {
    failures.push(`${route}: expected status ${expected} but got ${res.status}`);
  } else {
    console.log(`ok   ${route} -> status ${expected}`);
  }
}

function assertLocation(route, res, expected) {
  const location = res.headers.get("location");
  const actual = location ? new URL(location, BASE).href : null;
  const expectedUrl = new URL(expected, BASE).href;
  if (actual !== expectedUrl) {
    failures.push(`${route}: expected Location ${expectedUrl} but got ${JSON.stringify(location)}`);
  } else {
    console.log(`ok   ${route} -> Location: ${actual}`);
  }
}

function assertRobotsMeta(route, html, expected) {
  const robotsMeta = html.match(/<meta[^>]+name=["']robots["'][^>]+>/i)?.[0] ?? "";
  if (!robotsMeta.toLowerCase().includes(expected.toLowerCase())) {
    failures.push(`${route}: expected robots metadata to include ${JSON.stringify(expected)} but got ${JSON.stringify(robotsMeta)}`);
  } else {
    console.log(`ok   ${route} -> robots metadata includes ${expected}`);
  }
}

async function checkSitemap() {
  const response = await fetch(`${BASE}/sitemap.xml`);
  assertStatus("/sitemap.xml", response, 200);
  const xml = await response.text();
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  if (locations.length === 0) {
    failures.push("/sitemap.xml: expected at least one <loc>");
    return;
  }

  const uniqueLocations = new Set(locations);
  if (uniqueLocations.size !== locations.length) {
    failures.push(`/sitemap.xml: contains duplicate URLs (${locations.length - uniqueLocations.size})`);
  } else {
    console.log(`ok   /sitemap.xml -> ${locations.length} unique URLs`);
  }

  for (const location of locations) {
    const url = new URL(location);
    if (url.protocol !== "https:" || url.hostname !== "gamexs.ir") {
      failures.push(`/sitemap.xml: non-canonical host or protocol in ${location}`);
    }
    if (url.search || url.hash || (url.pathname.length > 1 && url.pathname.endsWith("/"))) {
      failures.push(`/sitemap.xml: query, hash, or trailing slash in ${location}`);
    }
    if (/\/(search|account|cart)(\/|$)/.test(url.pathname)) {
      failures.push(`/sitemap.xml: private/noindex route included: ${location}`);
    }
  }

  const lastModifiedValues = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((match) => Date.parse(match[1]));
  if (lastModifiedValues.some((value) => !Number.isFinite(value) || value > Date.now() + 300_000)) {
    failures.push("/sitemap.xml: contains invalid or future lastmod values");
  } else {
    console.log("ok   /sitemap.xml -> lastmod values are valid and not in the future");
  }

  for (const location of locations.slice(0, 5)) {
    const page = await fetch(location, { redirect: "manual" });
    if (page.status !== 200) {
      failures.push(`/sitemap.xml: ${location} returned ${page.status}`);
    } else if (page.headers.get("x-robots-tag") !== null) {
      failures.push(`/sitemap.xml: ${location} returned X-Robots-Tag ${page.headers.get("x-robots-tag")}`);
    }
  }
}

async function assertDynamicNotFound(route) {
  const response = await fetch(`${BASE}${route}`, { redirect: "manual" });
  if (response.status === 404) {
    console.log(`ok   ${route} -> status 404`);
    return;
  }
  if (response.status === 200) {
    assertRobotsMeta(route, await response.text(), "noindex");
    return;
  }
  failures.push(`${route}: expected 404 or streamed noindex response but got ${response.status}`);
}

async function run() {
  await waitForReady();

  // Brand new fetch per route (no shared cookie state needed).
  const home = await fetch(`${BASE}/`);
  assertHeader("/", home, "content-security-policy", "nonce-");
  assertHeader("/", home, "content-security-policy", "script-src");
  assertHeader("/", home, "x-frame-options", "DENY", { exact: true });
  assertHeader("/", home, "x-content-type-options", "nosniff", { exact: true });
  assertHeader("/", home, "referrer-policy", "strict-origin-when-cross-origin");
  assertHeader("/", home, "permissions-policy", "geolocation=()");

  // The CSP must be strict: no 'unsafe-inline' in script-src.
  const csp = home.headers.get("content-security-policy") ?? "";
  if (/script-src[^;]*'unsafe-inline'/.test(csp)) {
    failures.push("/: script-src still contains 'unsafe-inline'");
  } else {
    console.log("ok   / -> script-src has no 'unsafe-inline'");
  }

  const about = await fetch(`${BASE}/about`);
  assertHeader("/about", about, "cache-control", "public");

  const httpVariant = await fetch(`${BASE}/about`, {
    redirect: "manual",
    headers: { "x-forwarded-host": "gamexs.ir", "x-forwarded-proto": "http" },
  });
  assertStatus("HTTP /about", httpVariant, 308);
  assertLocation("HTTP /about", httpVariant, "https://gamexs.ir/about");

  const wwwVariant = await fetch(`${BASE}/about`, {
    redirect: "manual",
    headers: { "x-forwarded-host": "www.gamexs.ir", "x-forwarded-proto": "https" },
  });
  assertStatus("www /about", wwwVariant, 308);
  assertLocation("www /about", wwwVariant, "https://gamexs.ir/about");

  const trailingSlash = await fetch(`${BASE}/about/`, { redirect: "manual" });
  assertStatus("trailing slash /about/", trailingSlash, 308);
  assertLocation("trailing slash /about/", trailingSlash, "/about");

  const oldSlug = await fetch(`${BASE}/games/clair_obscur_expedition_33/?ref=legacy`, {
    redirect: "manual",
  });
  assertStatus("old game slug", oldSlug, 308);
  assertLocation("old game slug", oldSlug, "/games/clair-obscur-expedition-33?ref=legacy");

  const game = await fetch(`${BASE}/games/some-game`);
  assertHeader("/games/:slug", game, "cache-control", "s-maxage=300");
  assertNoHeader("/games/:slug", game, "x-robots-tag");

  for (const route of [
    "/genres/action",
    "/publishers/sony",
    "/ps-plus",
    "/account-games",
    "/disc-games",
    "/own-account-games",
    "/capacity-1",
  ]) {
    const response = await fetch(`${BASE}${route}`);
    assertNoHeader(route, response, "x-robots-tag");
  }

  const search = await fetch(`${BASE}/search`);
  assertHeader("/search", search, "x-robots-tag", "noindex, follow", { exact: true });
  assertRobotsMeta("/search", await search.text(), "noindex");

  const account = await fetch(`${BASE}/account`);
  assertHeader("/account", account, "cache-control", "private, no-store", { exact: true });
  assertHeader("/account", account, "cache-control", "no-store");
  assertHeader("/account", account, "x-robots-tag", "noindex, nofollow", { exact: true });

  const missing = await fetch(`${BASE}/this-page-does-not-exist`);
  assertStatus("genuine 404", missing, 404);
  assertRobotsMeta("genuine 404", await missing.text(), "noindex");

  for (const route of [
    "/games/definitely-not-a-real-game",
    "/genres/not-a-real-genre",
    "/publishers/not-a-real-publisher",
    "/ps-plus/not-a-real-tier",
  ]) {
    await assertDynamicNotFound(route);
  }

  await checkSitemap();

  const api = await fetch(`${BASE}/api/search?q=ab`);
  assertNoHeader("/api/search", api, "content-security-policy");
  const ct = api.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    failures.push("/api/search: expected JSON content-type");
  }

  if (failures.length) {
    console.error("\nHEADER CHECK FAILED:");
    failures.forEach((f) => console.error("  - " + f));
    process.exitCode = 1;
  } else {
    console.log("\nAll header checks passed.");
    process.exitCode = 0;
  }
}

run()
  .catch((err) => {
    console.error("Header check error:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    child.kill("SIGTERM");
  });
