import { expect, test, type Page } from "@playwright/test";

async function openSearch(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "جستجو" }).first().click();
  const dialog = page.getByRole("dialog", { name: "جستجو" });
  await expect(dialog).toBeVisible();
  return dialog.getByRole("searchbox", { name: "جستجو", exact: true });
}

test("search overlay shows failure state and recovers on retry", async ({ page }) => {
  let searchCalls = 0;

  await page.route("**/api/search?q=*", async (route) => {
    searchCalls += 1;
    if (searchCalls === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "temporary failure" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          slug: "elden-ring",
          title: "Elden Ring",
          coverUrl: null,
          genreLabel: "اکشن نقش‌آفرینی",
          lowestPriceToman: 2500000,
        },
      ]),
    });
  });

  const searchInput = await openSearch(page);
  await searchInput.fill("elden");

  await expect(page.getByText("جستجو موقتاً در دسترس نیست")).toBeVisible();
  await expect(searchInput).toHaveAttribute("aria-invalid", "true");

  await page.getByRole("button", { name: "تلاش دوباره" }).click();

  await expect(page.getByRole("option", { name: /Elden Ring/ })).toBeVisible();
  await expect(searchInput).toHaveAttribute("aria-invalid", "false");
});

test("search overlay distinguishes empty results from failed search", async ({ page }) => {
  await page.route("**/api/search?q=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  const searchInput = await openSearch(page);
  await searchInput.fill("notrealgame");

  await expect(page.getByText("نتیجه‌ای برای «notrealgame» یافت نشد")).toBeVisible();
  await expect(page.getByText("جستجو موقتاً در دسترس نیست")).toHaveCount(0);
});

test("auth modal validates required login fields before submission", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "ورود" }).first().click();

  const dialog = page.getByRole("dialog", { name: "GameXS" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "ورود به حساب" }).click();

  const phoneInput = dialog.getByPlaceholder("09XXXXXXXXX").first();
  const passwordInput = dialog.getByPlaceholder("رمز عبور خود را وارد کنید");

  await expect(dialog.getByText("شماره موبایل باید با 09 شروع شود و ۱۱ رقم باشد.")).toBeVisible();
  await expect(dialog.getByText("رمز عبور را وارد کنید.")).toBeVisible();
  await expect(phoneInput).toHaveAttribute("aria-invalid", "true");
  await expect(passwordInput).toHaveAttribute("aria-invalid", "true");
  await expect(phoneInput).toBeFocused();
});

test("search page gives a first action before a valid query", async ({ page }) => {
  await page.goto("/search", { waitUntil: "domcontentloaded" });

  const searchForm = page.getByRole("search");
  await expect(page.getByRole("heading", { name: "جستجوی بازی‌های PS5" })).toBeVisible();
  await expect(searchForm.getByRole("searchbox", { name: "جستجوی بازی" })).toBeVisible();
  await expect(searchForm.getByRole("button", { name: "جستجو" })).toBeVisible();
  await expect(page.getByRole("link", { name: "GTA" })).toHaveAttribute("href", "/search?q=GTA");
});

test("search page no-results state keeps the query recoverable", async ({ page }) => {
  const query = "zzzxqnotagame2026";
  await page.goto(`/search?q=${query}`, { waitUntil: "domcontentloaded" });

  const searchForm = page.getByRole("search");
  await expect(page.getByRole("heading", { name: `نتیجه‌ای برای «${query}» یافت نشد` })).toBeVisible();
  await expect(searchForm.getByRole("searchbox", { name: "جستجوی بازی" })).toHaveValue(query);
  await expect(searchForm.getByRole("button", { name: "جستجوی دوباره" })).toBeVisible();
});

test("upcoming page renders the pre-order shell", async ({ page }) => {
  const response = await page.goto("/upcoming", { waitUntil: "domcontentloaded" });
  const main = page.getByRole("main");

  expect(response?.status(), "upcoming route status").toBeLessThan(500);
  await expect(main.getByRole("heading", { name: "بازی‌های پیش‌خرید" })).toBeVisible();
  await expect(main.getByText("بازی‌هایی که هنوز منتشر نشده‌اند — مرتب‌شده بر اساس تاریخ انتشار")).toBeVisible();
});

test("product category routes render usable catalog shells", async ({ page }) => {
  const routes = [
    { path: "/account-games", heading: "اکانت بازی PS5" },
    { path: "/disc-games", heading: "دیسک بازی PS5" },
    { path: "/capacity-2", heading: "اکانت ظرفیت ۲ PS5" },
  ];

  for (const route of routes) {
    const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${route.path} status`).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "جستجوی بازی" })).toBeVisible();
  }
});

test("genre route renders a filterable catalog shell", async ({ page }) => {
  const response = await page.goto("/genres/shooter", { waitUntil: "domcontentloaded" });

  expect(response?.status(), "genre status").toBeLessThan(500);
  await expect(page.getByRole("heading", { name: "بازی‌های شوتر" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "جستجوی بازی" })).toBeVisible();
});
