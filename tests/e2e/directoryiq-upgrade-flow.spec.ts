import { expect, test } from "@playwright/test";

test.describe("DirectoryIQ listing upgrade flow", () => {
  test("Generate -> Preview -> gated Approve & Push", async ({ page }) => {
    test.skip(process.env.E2E_MOCK_OPENAI !== "1", "E2E_MOCK_OPENAI=1 required.");

    await page.goto("/directoryiq/listings/378", { waitUntil: "networkidle" });

    const section = page
      .getByRole("heading", { name: "Generate Upgrade Multi-Action System" })
      .first()
      .locator("xpath=ancestor::section[1]");

    await expect(section).toBeVisible();

    await section.getByRole("button", { name: "Generate Upgrade" }).click();

    await expect(section.getByRole("button", { name: "Preview Changes" })).toBeVisible({ timeout: 20_000 });

    await section.getByRole("button", { name: "Preview Changes" }).click();

    await expect(section.getByText("Diff Viewer")).toBeVisible({ timeout: 20_000 });

    const pushButton = section.getByRole("button", { name: "Approve & Push to BD" });
    await expect(pushButton).toBeDisabled();

    await section.getByLabel("I reviewed the diff and approve this push.").check();
    await expect(pushButton).toBeEnabled();

    await pushButton.click();
    await expect(page.getByText("Listing upgrade pushed successfully.")).toBeVisible({ timeout: 20_000 });
  });
});
