import { defineConfig, devices } from "@playwright/test";

// Performance/smoke checks against a production build (not `next dev`).
//
// Usage (from frontend/):
//   npm run build
//   DATABASE_URL=postgresql://gamexs:gamexs@localhost:5434/gamexs npm run test:e2e
//
// Conservative thresholds on purpose: the goal is to catch obvious regressions
// before deploy, not to fail on minor variance.

const PORT = process.env.TEST_PORT ?? "3010";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node_modules/.bin/next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { ...process.env, PORT },
  },
});
