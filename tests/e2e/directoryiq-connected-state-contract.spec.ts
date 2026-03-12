import { expect, test } from "@playwright/test";

test.describe("DirectoryIQ Connected-State Contract", () => {
  test("uses canonical BD site state for connected badge and credential wording for providers", async ({ page }) => {
    await page.route("**/api/directoryiq/dashboard", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          connected: false,
          readiness: 0,
          pillars: { structure: 0, clarity: 0, trust: 0, authority: 0, actionability: 0 },
          listings: [],
          vertical_detected: "general",
          vertical_override: null,
          last_analyzed_at: null,
          progress_messages: ["Evaluating selection signals..."],
        }),
      });
    });

    await page.route("**/api/directoryiq/signal-sources", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          connectors: [
            {
              connector_id: "brilliant_directories_api",
              connected: false,
              label: null,
              masked_secret: "****bd",
              updated_at: "2026-03-12T00:00:00.000Z",
              config: null,
            },
            {
              connector_id: "openai",
              connected: true,
              label: null,
              masked_secret: "****open",
              updated_at: "2026-03-12T00:00:00.000Z",
              config: null,
            },
            {
              connector_id: "serpapi",
              connected: false,
              label: null,
              masked_secret: "",
              updated_at: null,
              config: null,
            },
            {
              connector_id: "ga4",
              connected: false,
              label: null,
              masked_secret: "",
              updated_at: null,
              config: null,
            },
          ],
        }),
      });
    });

    await page.route("**/api/directoryiq/sites", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sites: [],
          is_admin: false,
          limit: 1,
        }),
      });
    });

    await page.route("**/api/directoryiq/ingest/runs", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ runs: [] }),
      });
    });

    await page.goto("/directoryiq", { waitUntil: "networkidle" });
    await expect(page.getByText("BD Site Not Connected")).toBeVisible();

    await page.goto("/directoryiq/signal-sources", { waitUntil: "networkidle" });
    const configError = page.getByText(
      "Signal Sources requires a valid external DirectoryIQ API origin. Configure NEXT_PUBLIC_DIRECTORYIQ_API_BASE to a non-Vercel origin."
    );
    if ((await configError.count()) > 0) {
      await expect(configError).toBeVisible();
      await expect(page.getByText("Credential not configured")).toHaveCount(3);
    } else {
      await expect(page.getByText("Credential saved (****open)")).toBeVisible();
    }
    await expect(page.getByText("Connected (****open)")).toHaveCount(0);
  });
});
