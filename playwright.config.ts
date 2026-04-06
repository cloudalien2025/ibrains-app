import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const e2ePort = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? "3012", 10);
const baseURL = process.env.UI_AUDIT_BASE_URL || `http://127.0.0.1:${e2ePort}`;
const outputDir = path.join(process.cwd(), "artifacts", "playwright");
const tmpDir = path.join(outputDir, ".tmp");

const inDocker = fs.existsSync("/.dockerenv");
const isRoot = typeof process.getuid === "function" ? process.getuid() === 0 : false;
const forceNoSandbox = process.env.PW_NO_SANDBOX === "1";
const executablePath = process.env.PW_EXECUTABLE_PATH || undefined;
process.env.E2E_MOCK_GRAPH ??= "1";
process.env.NEXT_TELEMETRY_DISABLED ??= "1";
// Chromium sandbox can crash in root/docker environments; keep it on elsewhere.
const needsNoSandbox = forceNoSandbox || inDocker || isRoot;
const chromiumArgs = needsNoSandbox
  ? [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-crash-reporter",
      "--disable-features=Crashpad,CrashpadHandler",
      "--disable-breakpad",
      // `--single-process` is unstable in CI/root containers and causes browser crashes.
      "--disable-dev-shm-usage",
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
  workers: process.env.CI ? 1 : undefined,
  timeout: 45_000,
  outputDir,
  webServer: {
    command:
      `bash -lc 'lsof -ti tcp:${e2ePort} | xargs -r kill -9; rm -f .next/lock; ` +
      `pnpm exec next build && pnpm exec next start -p ${e2ePort} -H 127.0.0.1'`,
    // Health endpoint is stable for readiness checks in E2E mode.
    url: `http://127.0.0.1:${e2ePort}/api/health`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      ...process.env,
      E2E_MOCK_GRAPH: "1",
      NODE_ENV: "test",
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
        "pk_test_ZGVsaWNhdGUtaWJleC04Ny5jbGVyay5hY2NvdW50cy5kZXYk",
      CLERK_PUBLISHABLE_KEY:
        process.env.CLERK_PUBLISHABLE_KEY ??
        "pk_test_ZGVsaWNhdGUtaWJleC04Ny5jbGVyay5hY2NvdW50cy5kZXYk",
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? "sk_test_codex_e2e",
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
