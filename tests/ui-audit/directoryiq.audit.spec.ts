import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";

type ConsoleItem = {
  level: string;
  text: string;
  url?: string;
};

type NetworkItem = {
  type: "requestfailed" | "http-error";
  method: string;
  url: string;
  status?: number;
  failureText?: string;
};

type RouteMetrics = {
  route: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: "ok" | "error";
  error?: string;
  screenshotFiles: string[];
};

type AuditMetrics = {
  baseUrl: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  imageErrorCount: number;
  routes: RouteMetrics[];
};

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

async function screenshot(page: Page, fullPath: string): Promise<void> {
  await page.screenshot({ path: fullPath, fullPage: true });
}

async function run(): Promise<void> {
  const baseUrl = process.env.UI_AUDIT_BASE_URL || "http://127.0.0.1:3001";
  const listingId = process.env.UI_AUDIT_LISTING_ID || "321";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const root = path.join(process.cwd(), "artifacts", "ui-audit", stamp);
  const shotsDir = path.join(root, "screenshots");
  const logsDir = path.join(root, "logs");
  const harPath = path.join(root, "har", "directoryiq-audit.har");
  await fs.mkdir(shotsDir, { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });
  await fs.mkdir(path.dirname(harPath), { recursive: true });

  const consoleItems: ConsoleItem[] = [];
  const networkItems: NetworkItem[] = [];
  let imageErrorCount = 0;
  const metrics: AuditMetrics = {
    baseUrl,
    startedAt: new Date().toISOString(),
    endedAt: "",
    durationMs: 0,
    imageErrorCount: 0,
    routes: [],
  };
  const totalStarted = Date.now();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordHar: { path: harPath },
    extraHTTPHeaders: {
      "x-user-brains": "directoryiq,ecomviper,studio",
      "x-user-entitlements": "directoryiq,ecomviper,studio",
      "x-user-role": "admin",
      "x-user-is-admin": "true",
      "x-user-name": "UI Audit",
    },
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    consoleItems.push({
      level: msg.type(),
      text: msg.text(),
      url: msg.location().url || undefined,
    });
  });

  page.on("requestfailed", (req) => {
    const failure = req.failure()?.errorText ?? "";
    const isRscAbort =
      req.method() === "GET" &&
      req.url().includes("_rsc=") &&
      failure.includes("ERR_ABORTED");
    if (isRscAbort) return;
    networkItems.push({
      type: "requestfailed",
      method: req.method(),
      url: req.url(),
      failureText: failure || undefined,
    });
  });

  page.on("response", (res) => {
    if (res.status() >= 400) {
      const req = res.request();
      if (req.resourceType() === "image") {
        imageErrorCount += 1;
      }
      networkItems.push({
        type: "http-error",
        method: req.method(),
        url: res.url(),
        status: res.status(),
      });
    }
  });

  const routes = [
    "/directoryiq",
    `/directoryiq/listings/${encodeURIComponent(listingId)}`,
    "/directoryiq/signal-sources",
  ];

  for (const route of routes) {
    const started = Date.now();
    const screenshotFiles: string[] = [];
    const routeMetric: RouteMetrics = {
      route,
      startedAt: new Date(started).toISOString(),
      endedAt: "",
      durationMs: 0,
      status: "ok",
      screenshotFiles,
    };

    try {
      await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle", timeout: 45_000 });
      const prefix = sanitize(route);

      const fullShot = `${prefix}__full.png`;
      await screenshot(page, path.join(shotsDir, fullShot));
      screenshotFiles.push(fullShot);

      if (route.includes("/listings/")) {
        const hero = page.locator('[data-testid="directoryiq-listing-hero"]').first();
        if (await hero.isVisible().catch(() => false)) {
          const heroShot = `${prefix}__hero-section.png`;
          await hero.screenshot({ path: path.join(shotsDir, heroShot) });
          screenshotFiles.push(heroShot);
        }

        const authorityTitle = page.getByRole("heading", { name: "Authority Support" }).first();
        if (await authorityTitle.isVisible().catch(() => false)) {
          const authorityShot = `${prefix}__authority-section.png`;
          const card = authorityTitle.locator("xpath=ancestor::section[1]");
          await card.screenshot({ path: path.join(shotsDir, authorityShot) });
          screenshotFiles.push(authorityShot);
        }

        const generateBtn = page.getByRole("button", { name: "Generate Draft" }).first();
        if (await generateBtn.isVisible().catch(() => false)) {
          await generateBtn.click();
          await page.waitForTimeout(600);
          const validationShot = `${prefix}__generate-draft-validation.png`;
          await screenshot(page, path.join(shotsDir, validationShot));
          screenshotFiles.push(validationShot);
        }

        const previewBtn = page.getByRole("button", { name: "Preview" }).first();
        if (await previewBtn.isVisible().catch(() => false)) {
          await previewBtn.click();
          await page.waitForTimeout(600);
          const previewValidationShot = `${prefix}__preview-validation.png`;
          await screenshot(page, path.join(shotsDir, previewValidationShot));
          screenshotFiles.push(previewValidationShot);
        }
      }

      if (route.includes("/signal-sources")) {
        const configureOrEdit = page
          .getByRole("button")
          .filter({ hasText: /Configure|Edit/i })
          .first();
        if (await configureOrEdit.isVisible().catch(() => false)) {
          await configureOrEdit.click();
          await page.waitForTimeout(500);
          const drawerShot = `${prefix}__drawer-open.png`;
          await screenshot(page, path.join(shotsDir, drawerShot));
          screenshotFiles.push(drawerShot);
        }
      }
    } catch (error) {
      routeMetric.status = "error";
      routeMetric.error = error instanceof Error ? error.message : "Unknown route error";
    } finally {
      routeMetric.endedAt = new Date().toISOString();
      routeMetric.durationMs = Date.now() - started;
      metrics.routes.push(routeMetric);
    }
  }

  await context.close();
  await browser.close();

  metrics.endedAt = new Date().toISOString();
  metrics.durationMs = Date.now() - totalStarted;
  metrics.imageErrorCount = imageErrorCount;

  await fs.writeFile(path.join(logsDir, "console.json"), `${JSON.stringify(consoleItems, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(logsDir, "network.json"), `${JSON.stringify(networkItems, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(root, "metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`, "utf8");

  process.stdout.write(`${root}\n`);
}

run().catch((error) => {
  console.error("[directoryiq-ui-audit]", error);
  process.exit(1);
});
