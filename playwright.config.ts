import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const baseURL = process.env.UI_AUDIT_BASE_URL || "http://127.0.0.1:3001";
const outputDir = path.join(process.cwd(), "artifacts", "playwright");
const tmpDir = path.join(outputDir, ".tmp");

fs.mkdirSync(tmpDir, { recursive: true });
process.env.TMPDIR ??= tmpDir;
process.env.TMP ??= tmpDir;
process.env.TEMP ??= tmpDir;

const originalRename = fs.promises.rename.bind(fs.promises);
fs.promises.rename = async (from, to) => {
  try {
    await originalRename(from, to);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === "EXDEV") {
      await fs.promises.copyFile(from, to);
      await fs.promises.unlink(from);
      return;
    }
    throw error;
  }
};

export default defineConfig({
  testDir: "./tests",
  testMatch: ["**/e2e/**/*.spec.ts", "**/ui-audit/**/*.hero.spec.ts", "**/ui-audit/**/*.shell.spec.ts"],
  retries: 1,
  timeout: 45_000,
  outputDir,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    extraHTTPHeaders: {
      "x-user-brains": "directoryiq,ecomviper,studio",
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
