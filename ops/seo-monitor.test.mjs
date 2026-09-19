import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { test } from "node:test";

const monitoredRoutes = [
  "/",
  "/robots.txt",
  "/sitemap.xml",
  "/image-sitemap.xml",
  "/games/healthy-game",
  "/publishers/healthy-publisher",
  "/genres/healthy-genre",
  "/ps-plus/essential",
  "/capacity-2",
];

async function withServer(handler, callback) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const { port } = server.address();
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

function runMonitor(baseUrl, overrides = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["ops/seo-monitor.mjs"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        SEO_BASE_URL: baseUrl,
        SEO_MONITOR_GAME_SLUG: "healthy-game",
        SEO_MONITOR_PUBLISHER_SLUG: "healthy-publisher",
        SEO_MONITOR_GENRE_SLUG: "healthy-genre",
        SEO_MONITOR_PS_PLUS_TIER: "essential",
        SEO_MONITOR_PURCHASE_TYPE: "capacity-2",
        SEO_MONITOR_TIMEOUT_MS: "2000",
        SEO_MONITOR_MAX_LATENCY_MS: "5000",
        ...overrides,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function routeHandler({ streamedNotFound = false, noindex = false } = {}) {
  return (request, response) => {
    const contentType = request.url.endsWith(".xml")
      ? "application/xml"
      : request.url === "/robots.txt"
        ? "text/plain"
        : "text/html";
    response.setHeader("content-type", `${contentType}; charset=utf-8`);

    if (request.url === "/sitemap.xml") {
      response.end("<urlset><url><loc>https://gamexs.ir/</loc></url></urlset>");
      return;
    }
    if (request.url === "/image-sitemap.xml") {
      response.end("<urlset xmlns:image=\"http://www.google.com/schemas/sitemap-image/1.1\"></urlset>");
      return;
    }
    if (request.url === "/robots.txt") {
      response.end("User-agent: *\nAllow: /");
      return;
    }

    const robots = noindex ? '<meta name="robots" content="noindex">' : "";
    const title = streamedNotFound
      ? "<title>صفحه پیدا نشد | GameXS</title>"
      : "<title>GameXS</title>";
    response.end(`<!doctype html><html><head>${title}${robots}</head><body>ok</body></html>`);
  };
}

test("SEO monitor accepts healthy public routes", async () => {
  const result = await withServer(routeHandler(), (baseUrl) => runMonitor(baseUrl));

  assert.equal(result.code, 0, result.stdout || result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.failures, []);
  assert.deepEqual(report.results.map(({ path }) => path), monitoredRoutes);
});

test("SEO monitor rejects a streamed 404 served with HTTP 200", async () => {
  const result = await withServer(
    (request, response) => {
      if (request.url === "/games/broken-game") {
        response.setHeader("content-type", "text/html; charset=utf-8");
        response.end("<title>صفحه پیدا نشد | GameXS</title>");
        return;
      }
      routeHandler()(request, response);
    },
    (baseUrl) => runMonitor(baseUrl, { SEO_MONITOR_GAME_SLUG: "broken-game" }),
  );

  assert.equal(result.code, 1, result.stdout || result.stderr);
  assert.match(result.stdout, /not-found document returned with HTTP 200/);
});

test("SEO monitor rejects an accidental noindex response", async () => {
  const result = await withServer(
    (request, response) => {
      if (request.url === "/publishers/private-publisher") {
        routeHandler({ noindex: true })(request, response);
        return;
      }
      routeHandler()(request, response);
    },
    (baseUrl) => runMonitor(baseUrl, { SEO_MONITOR_PUBLISHER_SLUG: "private-publisher" }),
  );

  assert.equal(result.code, 1, result.stdout || result.stderr);
  assert.match(result.stdout, /noindex response on monitored route/);
});

test("SEO monitor selects representative catalog routes from the live sitemap", async () => {
  const sitemap = [
    "https://gamexs.ir/games/catalog-game",
    "https://gamexs.ir/publishers/catalog-publisher",
    "https://gamexs.ir/genres/catalog-genre",
    "https://gamexs.ir/ps-plus/extra",
    "https://gamexs.ir/capacity-3",
  ].map((url) => `<url><loc>${url}</loc></url>`).join("");
  const seen = [];
  const result = await withServer((request, response) => {
    seen.push(request.url);
    if (request.url === "/sitemap.xml") {
      response.setHeader("content-type", "application/xml; charset=utf-8");
      response.end(`<urlset>${sitemap}</urlset>`);
      return;
    }
    routeHandler()(request, response);
  }, (baseUrl) => runMonitor(baseUrl, {
    SEO_MONITOR_GAME_SLUG: "",
    SEO_MONITOR_PUBLISHER_SLUG: "",
    SEO_MONITOR_GENRE_SLUG: "",
    SEO_MONITOR_PS_PLUS_TIER: "",
    SEO_MONITOR_PURCHASE_TYPE: "",
  }));

  assert.equal(result.code, 0, result.stdout || result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.results.map(({ path }) => path), [
    "/", "/robots.txt", "/sitemap.xml", "/image-sitemap.xml",
    "/games/catalog-game", "/publishers/catalog-publisher", "/genres/catalog-genre",
    "/ps-plus/extra", "/capacity-3",
  ]);
  assert.ok(seen.includes("/publishers/catalog-publisher"));
});

test("SEO monitor limits concurrent requests", async () => {
  let active = 0;
  let maxActive = 0;
  const result = await withServer((request, response) => {
    active++;
    maxActive = Math.max(maxActive, active);
    setTimeout(() => {
      routeHandler()(request, response);
      active--;
    }, 30);
  }, (baseUrl) => runMonitor(baseUrl, { SEO_MONITOR_CONCURRENCY: "2" }));

  assert.equal(result.code, 0, result.stdout || result.stderr);
  assert.equal(maxActive, 2);
});
