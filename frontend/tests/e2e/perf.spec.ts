import { test, expect, type Page } from "@playwright/test";

// Smoke + performance check for the core catalog routes. Thresholds are
// deliberately conservative so the suite catches gross regressions without
// being flaky/noisy.

const ROUTES = [
  { name: "home", path: "/" },
  { name: "search", path: "/search" },
  { name: "account", path: "/account" },
  { name: "cart", path: "/cart" },
  { name: "about", path: "/about" },
  { name: "ps-plus", path: "/ps-plus" },
];

async function collectPageMetrics(page: Page) {
  return page.evaluate(async () => {
    const metrics: Record<string, number> = {};
    await new Promise<void>((resolve) => {
      let lcp = 0;
      let cls = 0;
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (e.entryType === "largest-contentful-paint" && (e as { startTime: number }).startTime > lcp) {
              lcp = (e as { startTime: number }).startTime;
            }
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });
      } catch {
        /* not supported */
      }
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as { value: number }[]) cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
      } catch {
        /* not supported */
      }
      setTimeout(() => {
        metrics.lcp = lcp;
        metrics.cls = cls;
        resolve();
      }, 200);
    });
    return metrics;
  });
}

test("core catalog routes load without errors", async ({ page }) => {
  for (const route of ROUTES) {
    const pageErrors: string[] = [];
    const onError = (err: Error) => pageErrors.push(err.message);
    page.on("pageerror", onError);
    const resp = await page.goto(route.path, { waitUntil: "networkidle" });
    expect(resp?.status(), `${route.name} status`).toBeLessThan(500);
    expect(pageErrors, `${route.name} page errors`).toEqual([]);
    page.off("pageerror", onError);
  }
});

test("homepage LCP stays conservative", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await page.goto("/", { waitUntil: "networkidle" });
  const metrics = await collectPageMetrics(page);
  // Conservative: fail only on a clearly broken page.
  expect(metrics.lcp, "homepage LCP should be < 6000ms").toBeLessThan(6000);
  expect(pageErrors, "homepage page errors").toEqual([]);
});

test("game detail page loads a real slug from the homepage grid", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const href = await page.locator('a[href^="/games/"]').first().getAttribute("href");
  test.skip(!href, "no game links on homepage (empty DB)");

  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  const resp = await page.goto(href!, { waitUntil: "networkidle" });
  expect(resp?.status(), "game detail status").toBeLessThan(500);
  expect(pageErrors, "game detail page errors").toEqual([]);
  await expect(page.getByRole("heading", { name: "روند قیمت" })).toBeVisible();
});

test("sitemaps expose unique canonical URLs", async ({ request }) => {
  const sitemapResponse = await request.get("/sitemap.xml");
  expect(sitemapResponse.status(), "sitemap status").toBe(200);
  expect(sitemapResponse.headers()["content-type"]).toContain("application/xml");
  const sitemap = await sitemapResponse.text();
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

  expect(sitemapUrls.length, "sitemap should contain URLs").toBeGreaterThan(0);
  expect(new Set(sitemapUrls).size, "sitemap URLs should be unique").toBe(sitemapUrls.length);
  expect(sitemapUrls.every((url) => {
    const parsed = new URL(url);
    return !parsed.search && (parsed.pathname === "/" || !parsed.pathname.endsWith("/"));
  })).toBe(true);
  expect(sitemapUrls.map((url) => new URL(url).pathname)).not.toContain(
    "/games/grand-theft-auto-the-trilogy-the-definitive-edition"
  );

  const imageSitemapResponse = await request.get("/image-sitemap.xml");
  expect(imageSitemapResponse.status(), "image sitemap status").toBe(200);
  expect(imageSitemapResponse.headers()["content-type"]).toContain("application/xml");
  const imageSitemap = await imageSitemapResponse.text();
  expect(imageSitemap).toContain("xmlns:image=");
});
