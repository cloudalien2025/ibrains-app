import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

test("DirectoryIQ signal sources renders Ferrari shell styling", async ({ page }) => {
  await page.goto("/directoryiq/signal-sources", { waitUntil: "networkidle" });

  const shell = page.locator(".ecomviper-hud");
  await expect(shell).toBeVisible();
  await expect(page.locator(".ecomviper-grid")).toBeVisible();

  const sidebar = page.locator("aside").first();
  await expect(sidebar).toBeVisible();

  const shellBackground = await shell.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(shellBackground).not.toBe("rgb(255, 255, 255)");

  const shellTextColor = await shell.evaluate((el) => getComputedStyle(el).color);
  expect(shellTextColor).not.toBe("rgb(0, 0, 0)");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join("artifacts", "ui-audit", timestamp);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: path.join(dir, "directoryiq-signal-sources.png"),
    fullPage: true,
  });
});
