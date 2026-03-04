import { expect, test } from "@playwright/test";

test.describe("DirectoryIQ Authority Graph v1", () => {
  test("scan renders deterministic issues and evidence drawer", async ({ page }) => {
    test.skip(process.env.E2E_MOCK_GRAPH !== "1", "E2E_MOCK_GRAPH=1 required.");

    await page.goto("/directoryiq/authority-support", { waitUntil: "networkidle" });

    const scanButton = page.getByRole("button", { name: "Scan for Authority Leaks" });
    await expect(scanButton).toBeVisible();
    await scanButton.click();

    const orphanCard = page.getByRole("button", { name: /Orphan Listings/i });
    const mentionCard = page.getByRole("button", { name: /Mentions Without Links/i });
    const weakCard = page.getByRole("button", { name: /Weak Anchors/i });

    await expect(orphanCard).toContainText("1");
    await expect(mentionCard).toContainText("1");
    await expect(weakCard).toContainText("1");

    await mentionCard.click();

    const mentionRow = page.getByRole("button", { name: /How to Pick a Reliable Plumber/i });
    await expect(mentionRow).toBeVisible();

    await mentionRow.click();

    await expect(page.getByText("source_url")).toBeVisible();
    await expect(page.getByText("target_url")).toBeVisible();
    await expect(page.getByText("anchor_text")).toBeVisible();
    await expect(page.getByText("context_snippet")).toBeVisible();
  });
});
