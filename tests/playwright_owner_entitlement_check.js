const { chromium } = require("playwright");

async function run() {
  const baseUrl = process.env.DIRECTORYIQ_UI_BASE_URL || "http://127.0.0.1:3000";
  const needsNoSandbox =
    process.env.PW_NO_SANDBOX === "1" ||
    (typeof process.getuid === "function" && process.getuid() === 0);
  const browser = await chromium.launch({
    headless: true,
    chromiumSandbox: false,
    args: needsNoSandbox
      ? [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-crash-reporter",
          "--disable-features=Crashpad,CrashpadHandler",
          "--disable-breakpad",
          "--no-zygote",
          "--single-process",
        ]
      : [],
  });
  const context = await browser.newContext({
    extraHTTPHeaders: {
      "cf-access-authenticated-user-email": "owner@example.com",
      "x-forwarded-email": "owner@example.com",
      "x-user-name": "Owner",
    },
  });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/directoryiq`, { waitUntil: "domcontentloaded" });

  const locked = page.getByText("Unlock DirectoryIQ");
  const lockedVisible = await locked.isVisible().catch(() => false);
  if (lockedVisible) {
    throw new Error("Owner still sees locked DirectoryIQ gate.");
  }

  await browser.close();
}

run().catch((error) => {
  console.error("[playwright-owner-entitlement-check]", error);
  process.exit(1);
});
