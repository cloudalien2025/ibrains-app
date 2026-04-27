import { expect, test } from "@playwright/test";

test.use({
  extraHTTPHeaders: {},
});

async function assertNoClientLoadErrors(page: import("@playwright/test").Page) {
  const runtimeErrors: string[] = [];
  const consoleErrors: string[] = [];
  const requestFailures: string[] = [];

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
    const resourceType = request.resourceType();
    const url = request.url();
    const isCriticalResource =
      resourceType === "document" || resourceType === "stylesheet" || resourceType === "script" || url.includes("/_next/static/");

    if (!isCriticalResource) {
      return;
    }

    requestFailures.push(`${resourceType} ${url} :: ${request.failure()?.errorText ?? "unknown"}`);
  });

  return {
    async expectCleanLoad() {
      await expect
        .poll(() => ({
          runtimeErrors,
          consoleErrors: consoleErrors.filter((entry) => !entry.includes("favicon.ico")),
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

test.describe("production shell load", () => {
  test("sign-in page loads without client-side exception", async ({ page }) => {
    const watcher = await assertNoClientLoadErrors(page);

    await page.goto("/sign-in", { waitUntil: "networkidle" });

    await expect(page.getByText("Email address", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error: a client-side exception has occurred");
    await watcher.expectCleanLoad();
  });

  test("brains shell loads without client-side exception", async ({ page }) => {
    const watcher = await assertNoClientLoadErrors(page);

    await page.goto("/brains", { waitUntil: "networkidle" });

    await expect(page.getByRole("button", { name: "Create Brain" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error: a client-side exception has occurred");
    await watcher.expectCleanLoad();
  });
});
