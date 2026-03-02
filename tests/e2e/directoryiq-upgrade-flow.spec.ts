import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
const screenshotRoot = path.join(process.cwd(), "artifacts", "ui-audit", runStamp, "screenshots");

test.describe("DirectoryIQ auto-upgrade flow", () => {
  test("Generate Upgrade triggers request or explicit integration guidance", async ({ page }) => {
    await fs.mkdir(screenshotRoot, { recursive: true });
    await page.goto("/directoryiq/listings/378", { waitUntil: "networkidle" });

    const section = page.locator("h3", { hasText: "Auto-Generate Listing Upgrade" }).first().locator("xpath=ancestor::*[contains(@class,'rounded-xl')][1]");
    await expect(section).toBeVisible();

    let sawGenerateRequest = false;
    const handler = (request: { method: () => string; url: () => string }) => {
      if (
        request.method() === "POST" &&
        request.url().includes("/api/directoryiq/listings/378/upgrade/generate")
      ) {
        sawGenerateRequest = true;
      }
    };
    page.on("request", handler);

    await section.getByRole("button", { name: "Generate Upgrade" }).click();
    await page.waitForTimeout(1200);
    page.off("request", handler);

    const sawFeedback = await page
      .getByText(/Configure OpenAI in Integrations|Upgrade draft generated|OpenAI not configured/i)
      .first()
      .isVisible()
      .catch(() => false);

    await page.screenshot({
      path: path.join(screenshotRoot, "directoryiq-upgrade-flow__generate-step.png"),
      fullPage: true,
    });

    expect(sawGenerateRequest || sawFeedback).toBeTruthy();
  });

  test("mock mode shows preview + gated push without typing", async ({ page }) => {
    test.skip(
      process.env.E2E_MOCK_OPENAI !== "1",
      "Skipped: E2E_MOCK_OPENAI=1 required for deterministic generate/preview flow."
    );

    await page.goto("/directoryiq/listings/378", { waitUntil: "networkidle" });
    const section = page.locator("h3", { hasText: "Auto-Generate Listing Upgrade" }).first().locator("xpath=ancestor::*[contains(@class,'rounded-xl')][1]");
    await expect(section).toBeVisible();

    await section.getByRole("button", { name: "Generate Upgrade" }).click();
    await expect(section.getByRole("button", { name: "Preview Changes" })).toBeVisible();

    await section.getByRole("button", { name: "Preview Changes" }).click();
    await expect(section.getByText("Diff Viewer")).toBeVisible();

    const pushButton = section.getByRole("button", { name: "Approve & Push to BD" });
    await expect(pushButton).toBeDisabled();

    await section.getByLabel("I reviewed the diff and approve this push.").check();
    await expect(pushButton).toBeEnabled();

    await page.screenshot({
      path: path.join(screenshotRoot, "directoryiq-upgrade-flow__preview-gated-push-step.png"),
      fullPage: true,
    });
  });
});
