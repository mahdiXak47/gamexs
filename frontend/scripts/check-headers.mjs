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
  ["start", "-p", PORT],
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

  const game = await fetch(`${BASE}/games/some-game`);
  assertHeader("/games/:slug", game, "cache-control", "s-maxage=300");

  const account = await fetch(`${BASE}/account`);
  assertHeader("/account", account, "cache-control", "private, no-store", { exact: true });
  assertHeader("/account", account, "cache-control", "no-store");

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
