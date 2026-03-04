import { expect, test, type Page } from "@playwright/test";

function upgradeCard(page: Page) {
  return page
    .getByRole("heading", { name: "Auto-Generate Listing Upgrade" })
    .first()
    .locator("xpath=ancestor::section[1]");
}

test.describe("DirectoryIQ Authority Support buttons", () => {
  test("no-stub-input clicks always produce validation or visible feedback", async ({ page }) => {
    test.skip(process.env.E2E_MOCK_OPENAI !== "1", "E2E_MOCK_OPENAI=1 required.");

    await page.goto("/directoryiq/listings/378", { waitUntil: "networkidle" });

    const card = upgradeCard(page);
    await expect(card).toBeVisible();

    const actions = [
      {
        button: "Generate Upgrade",
        endpoint: "/api/directoryiq/listings/378/upgrade/generate",
        feedback: /Upgrade draft generated|Failed to generate upgrade|OpenAI not configured/i,
      },
      {
        button: "Preview Changes",
        endpoint: "/api/directoryiq/listings/378/upgrade/preview",
        feedback: /Diff Viewer|Failed to preview changes|Upgrade draft not found/i,
      },
    ];

    for (const action of actions) {
      let sawRequest = false;
      const handler = (request: { method: () => string; url: () => string }) => {
        if (request.method() === "POST" && request.url().includes(action.endpoint)) {
          sawRequest = true;
        }
      };

      page.on("request", handler);
      await card.getByRole("button", { name: action.button }).click();
      await page.waitForTimeout(1000);
      page.off("request", handler);

      const sawFeedback = await page.getByText(action.feedback).first().isVisible().catch(() => false);
      expect(
        sawRequest || sawFeedback,
        `${action.button} should trigger request or show immediate validation/feedback`
      ).toBeTruthy();
    }
  });

  test("network fires when prefilled values exist (no typing)", async ({ page }) => {
    test.skip(process.env.E2E_MOCK_OPENAI !== "1", "E2E_MOCK_OPENAI=1 required.");

    await page.goto("/directoryiq/listings/378", { waitUntil: "networkidle" });

    const card = upgradeCard(page);
    await expect(card).toBeVisible();

    const draftResponse = page.waitForResponse((response) => {
      return (
        response.request().method() === "POST" &&
        response.url().includes("/api/directoryiq/listings/378/upgrade/generate")
      );
    });

    await card.getByRole("button", { name: "Generate Upgrade" }).click();
    const response = await draftResponse;

    expect(response.status(), "Draft request should succeed when fields are prefilled").toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    await expect(page.getByText(/Upgrade draft generated/i)).toBeVisible({ timeout: 20_000 });

    const previewResponse = page.waitForResponse((response) => {
      return (
        response.request().method() === "POST" &&
        response.url().includes("/api/directoryiq/listings/378/upgrade/preview")
      );
    });

    await card.getByRole("button", { name: "Preview Changes" }).click();
    const preview = await previewResponse;
    expect(preview.status(), "Preview request should succeed after draft generation").toBeGreaterThanOrEqual(200);
    expect(preview.status()).toBeLessThan(300);
    await expect(card.getByText("Diff Viewer")).toBeVisible({ timeout: 20_000 });

    const pushButton = card.getByRole("button", { name: "Approve & Push to BD" });
    await expect(pushButton).toBeDisabled();
    await card.getByLabel("I reviewed the diff and approve this push.").check();
    await expect(pushButton).toBeEnabled();
  });
});
