import { expect, test, type Page } from "@playwright/test";

function slotCard(page: Page) {
  return page.locator("article", { hasText: "Slot 1" }).first();
}

test.describe("DirectoryIQ Authority Support buttons", () => {
  test("no-stub-input clicks always produce validation or visible feedback", async ({ page }) => {
    await page.goto("/directoryiq/listings/378", { waitUntil: "networkidle" });

    const card = slotCard(page);
    await expect(card).toBeVisible();

    const actions = [
      {
        button: "Generate Draft",
        endpoint: "/api/directoryiq/listings/378/authority/1/draft",
        feedback: /Focus topic is required|Draft ready|Draft generation failed/i,
      },
      {
        button: "Generate Featured Image",
        endpoint: "/api/directoryiq/listings/378/authority/1/image",
        feedback: /Focus topic is required|Featured image ready|Image generation failed/i,
      },
      {
        button: "Preview",
        endpoint: "/api/directoryiq/listings/378/authority/1/preview",
        feedback: /Generate a draft before opening preview|Preview failed|Diff Preview/i,
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
      await page.waitForTimeout(800);
      page.off("request", handler);

      const sawFeedback = await page.getByText(action.feedback).first().isVisible().catch(() => false);
      expect(
        sawRequest || sawFeedback,
        `${action.button} should trigger request or show immediate validation/feedback`
      ).toBeTruthy();
    }
  });

  test("network fires when prefilled values exist (no typing)", async ({ page }) => {
    await page.goto("/directoryiq/listings/378", { waitUntil: "networkidle" });

    const card = slotCard(page);
    await expect(card).toBeVisible();

    const titleValue = await card.getByPlaceholder("Post title").inputValue();
    const topicValue = await card.getByPlaceholder("Focus topic").inputValue();

    test.skip(
      !titleValue.trim() || !topicValue.trim(),
      "Skipped: required inputs not prefilled; stub input forbidden by task."
    );

    const draftResponse = page.waitForResponse((response) => {
      return (
        response.request().method() === "POST" &&
        response.url().includes("/api/directoryiq/listings/378/authority/1/draft")
      );
    });

    await card.getByRole("button", { name: "Generate Draft" }).click();
    const response = await draftResponse;

    expect(response.status(), "Draft request should succeed when fields are prefilled").toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    await expect(page.getByText(/Draft ready for slot 1|Draft generated for slot 1/i)).toBeVisible();
  });
});
