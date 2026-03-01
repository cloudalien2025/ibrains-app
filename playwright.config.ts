import { defineConfig } from "@playwright/test";

const baseURL = process.env.UI_AUDIT_BASE_URL || "http://127.0.0.1:3001";

export default defineConfig({
  testDir: "./tests/e2e",
  retries: 1,
  timeout: 45_000,
  outputDir: "artifacts/playwright",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    extraHTTPHeaders: {
      "x-user-entitlements": "directoryiq,ecomviper,studio",
      "x-user-role": "admin",
      "x-user-is-admin": "true",
      "x-user-name": "Playwright E2E",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
