import { expect, test } from "@playwright/test";

test("listing support diagnostics request settles without timeout on representative flow", async ({ page }) => {
  const listingId = "651";
  const siteId = "5c82f5c1-a45f-4b25-a0d4-1b749d962415";
  const supportPath = `/api/directoryiq/listings/${listingId}/support?site_id=${siteId}`;

  const startedAtByUrl = new Map<string, number>();
  const settledByUrl = new Map<string, { status: number | null; durationMs: number; outcome: "finished" | "failed" }>();

  page.on("request", (request) => {
    const url = request.url();
    if (url.includes(supportPath)) {
      startedAtByUrl.set(url, Date.now());
    }
  });

  page.on("response", async (response) => {
    const req = response.request();
    const url = req.url();
    if (!url.includes(supportPath)) return;
    const startedAt = startedAtByUrl.get(url) ?? Date.now();
    settledByUrl.set(url, {
      status: response.status(),
      durationMs: Date.now() - startedAt,
      outcome: "finished",
    });
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!url.includes(supportPath)) return;
    const startedAt = startedAtByUrl.get(url) ?? Date.now();
    settledByUrl.set(url, {
      status: null,
      durationMs: Date.now() - startedAt,
      outcome: "failed",
    });
  });

  await page.goto(`/directoryiq/listings/${listingId}?site_id=${siteId}`, { waitUntil: "domcontentloaded" });

  await expect.poll(() => settledByUrl.size, { timeout: 20000 }).toBeGreaterThan(0);

  const supportEntry = [...settledByUrl.values()][0];
  expect(supportEntry).toBeTruthy();
  console.log(`[support-runtime] outcome=${supportEntry?.outcome} status=${supportEntry?.status} duration=${supportEntry?.durationMs}ms`);
  expect(supportEntry?.outcome).toBe("finished");
  expect(supportEntry?.status).toBe(200);
  expect(supportEntry?.durationMs ?? 999999).toBeLessThan(8000);

  await expect(page.getByText("Loading support diagnostics...")).toHaveCount(0);
  await expect(page.getByText("Support diagnostics request timed out.")).toHaveCount(0);
});
