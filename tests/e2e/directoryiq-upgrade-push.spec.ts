import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const listingId = "3";
const outDir = path.join(process.cwd(), "artifacts", "push_to_bd");

function listingPayload() {
  return {
    listing: {
      listing_id: listingId,
      listing_name: "Fixture Listing",
      listing_url: "https://example.com/listings/fixture-listing",
      mainImageUrl: null,
      mainImageSource: "missing",
      imageResolutionAttempts: [],
    },
    evaluation: {
      totalScore: 68,
      scores: { structure: 67, clarity: 66, trust: 69, authority: 70, actionability: 68 },
      flags: {
        structuralGateActive: false,
        structuralHardFailActive: false,
        authorityCeilingActive: false,
        ambiguityPenaltyApplied: false,
        trustRiskCapActive: false,
      },
      caps: [],
      ambiguityPenalty: 0,
    },
    authority_posts: Array.from({ length: 4 }).map((_, idx) => ({
      id: `slot-${idx + 1}`,
      slot: idx + 1,
      type: "contextual_guide",
      title: "",
      focus_topic: "",
      status: "not_created",
      blog_to_listing_status: "missing",
      listing_to_blog_status: "missing",
      featured_image_url: null,
      published_url: null,
      updated_at: new Date().toISOString(),
    })),
    integrations: { brilliant_directories: true, openai: true },
  };
}

test.describe("DirectoryIQ upgrade push flow", () => {
  test("Generate Upgrade -> Preview Diff -> Approve & Push to BD", async ({ page }) => {
    await fs.mkdir(outDir, { recursive: true });

    const consoleLines: string[] = [];
    const networkLines: string[] = [];

    page.on("console", (message) => {
      consoleLines.push(`[${message.type()}] ${message.text()}`);
    });
    page.on("request", (request) => {
      networkLines.push(`REQ ${request.method()} ${request.url()}`);
    });
    page.on("response", (response) => {
      networkLines.push(`RES ${response.status()} ${response.request().method()} ${response.url()}`);
    });

    await page.route(`**/api/directoryiq/listings/${listingId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(listingPayload()),
      });
    });
    await page.route(`**/api/directoryiq/listings/${listingId}/upgrade/generate`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          draftId: "draft-123",
          proposedDescription: "Proposed deterministic description",
        }),
      });
    });
    await page.route(`**/api/directoryiq/listings/${listingId}/upgrade/preview`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          draftId: "draft-123",
          original: "Old description",
          proposed: "Proposed deterministic description",
          diff: [
            { left: "Old description", right: "Proposed deterministic description", type: "changed" },
          ],
          approvalToken: "approve-token",
        }),
      });
    });
    await page.route(`**/api/directoryiq/listings/${listingId}/upgrade/push`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, versionId: "version-123", bdResultSummary: { status: "ok" } }),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "networkidle" });
    await expect(page.getByText("Authority Support")).toBeVisible({ timeout: 20_000 });
    const section = page
      .locator("h3", { hasText: "Auto-Generate Listing Upgrade" })
      .first()
      .locator("xpath=ancestor::*[contains(@class,'rounded-xl')][1]");
    await expect(section).toBeVisible({ timeout: 20_000 });

    await section.getByRole("button", { name: "Generate Upgrade" }).click();
    await expect(section.getByRole("button", { name: "Preview Changes" })).toBeVisible();

    await section.getByRole("button", { name: "Preview Changes" }).click();
    await expect(section.getByText("Diff Viewer")).toBeVisible();

    const pushButton = section.getByRole("button", { name: "Approve & Push to BD" });
    await expect(pushButton).toBeDisabled();

    await section.getByLabel("I reviewed the diff and approve this push.").check();
    await expect(pushButton).toBeEnabled();

    await pushButton.click();

    await expect(page.getByText("Pushed to BD")).toBeVisible();
    await expect(page.getByText(/Request ID:/i)).toHaveCount(0);

    await fs.writeFile(path.join(outDir, "console.log"), `${consoleLines.join("\n")}\n`, "utf8");
    await fs.writeFile(path.join(outDir, "network.md"), `${networkLines.join("\n")}\n`, "utf8");
  });
});
