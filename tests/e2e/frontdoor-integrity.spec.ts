import { expect, test } from "@playwright/test";

async function watchFrontdoorLoad(page: import("@playwright/test").Page) {
  const runtimeErrors: string[] = [];
  const requestFailures: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (error) => {
    runtimeErrors.push(error.message);
  });

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    consoleErrors.push(message.text());
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!url.includes("/_next/static/")) {
      return;
    }

    requestFailures.push(`${url} :: ${request.failure()?.errorText ?? "unknown"}`);
  });

  return {
    async expectHealthy() {
      await expect
        .poll(() => ({
          runtimeErrors,
          consoleErrors,
          requestFailures,
        }))
        .toEqual({
          runtimeErrors: [],
          consoleErrors: [],
          requestFailures: [],
        });
    },
  };
}

test.describe("frontdoor integrity", () => {
  test("homepage loads without broken next assets or client exceptions", async ({ page }) => {
    const watcher = await watchFrontdoorLoad(page);

    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.getByText("Platform Intelligence Engine", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Brains", exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error: a client-side exception has occurred");
    await watcher.expectHealthy();
  });

  test("brains workspace loads without broken next assets or client exceptions", async ({ page }) => {
    const watcher = await watchFrontdoorLoad(page);

    await page.goto("/brains", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Manage Brains", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Console", exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error: a client-side exception has occurred");
    await watcher.expectHealthy();
  });
});
