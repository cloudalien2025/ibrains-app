import { expect, test } from "@playwright/test";

test.describe("SiteForge save+validate flow", () => {
  test("create/select project keeps stable project identity for save+validate", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => {
      consoleErrors.push(String(error));
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/apps/siteforge", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Setup", exact: true }).click();

    const projectName = `iPetzo ${Date.now()}`;
    await page.getByPlaceholder("e.g. iPetzo").fill(projectName);
    await page.getByRole("button", { name: "Create Project" }).click();

    const createdMessage = page.getByText(`Project created: ${projectName}`);
    const persistenceBlockedMessage = page
      .getByText(
        "Persistent SiteForge storage is unavailable in production. SiteForge is disabled until database storage is restored."
      )
      .first();

    await Promise.race([
      expect(createdMessage).toBeVisible(),
      expect(persistenceBlockedMessage).toBeVisible(),
    ]);

    if (await persistenceBlockedMessage.isVisible()) {
      await expect(createdMessage).toHaveCount(0);
      return;
    }

    const projectSelect = page.locator("select").first();
    const selectedProjectId = await projectSelect.inputValue();
    await expect(projectSelect).not.toHaveValue("");
    await expect(projectSelect.locator("option:checked")).toContainText(projectName);

    await page.getByPlaceholder("https://example.com").fill("https://example.com");
    await page.getByPlaceholder("WordPress username").fill("admin");
    await page.getByPlaceholder(/application password/i).fill("app-pass");

    const validateResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === "POST" &&
        response.url().includes(`/api/siteforge/projects/${encodeURIComponent(selectedProjectId)}/connection`)
      );
    });

    await page.getByRole("button", { name: "Check Connection" }).click();
    const validateResponse = await validateResponsePromise;

    expect(validateResponse.status()).toBe(200);
    await expect(page.getByText("Project not found.")).toHaveCount(0);
    await expect(page.getByText("Selected project could not be loaded.")).toHaveCount(0);
    await expect(projectSelect).toHaveValue(selectedProjectId);
    await expect(projectSelect.locator("option:checked")).toContainText(projectName);
    const blockingErrors = consoleErrors.filter((entry) => {
      return !entry.includes("clerk.accounts.dev") && !entry.includes("Failed to load resource: net::ERR_FAILED");
    });
    expect(blockingErrors).toEqual([]);
  });
});
