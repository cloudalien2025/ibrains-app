import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const baseURL = process.env.UI_AUDIT_BASE_URL || "http://127.0.0.1:3001";
const outputDir = path.join(process.cwd(), "artifacts", "playwright");
const tmpDir = path.join(outputDir, ".tmp");

const inDocker = fs.existsSync("/.dockerenv");
const isRoot = typeof process.getuid === "function" ? process.getuid() === 0 : false;
const forceNoSandbox = process.env.PW_NO_SANDBOX === "1";
const executablePath = process.env.PW_EXECUTABLE_PATH || undefined;
process.env.E2E_MOCK_GRAPH ??= "1";
// Chromium sandbox can crash in root/docker environments; keep it on elsewhere.
const needsNoSandbox = forceNoSandbox || inDocker || isRoot;
const chromiumArgs = needsNoSandbox
  ? [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-crash-reporter",
      "--disable-features=Crashpad,CrashpadHandler",
      "--disable-breakpad",
      "--no-zygote",
      "--single-process",
    ]
  : [];
const chromiumLaunchOptions = needsNoSandbox
  ? { args: chromiumArgs, chromiumSandbox: false, ...(executablePath ? { executablePath } : {}) }
  : { args: chromiumArgs, ...(executablePath ? { executablePath } : {}) };
const chromiumChannel = needsNoSandbox ? "chromium" : undefined;

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
  webServer: {
    command: "pnpm exec next dev -p 3001 -H 127.0.0.1",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      E2E_MOCK_GRAPH: "1",
      TMPDIR: "/tmp",
      TMP: "/tmp",
      TEMP: "/tmp",
    },
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    launchOptions: chromiumLaunchOptions,
    channel: chromiumChannel,
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
      use: {
        browserName: "chromium",
        launchOptions: chromiumLaunchOptions,
        channel: chromiumChannel,
      },
    },
  ],
});
