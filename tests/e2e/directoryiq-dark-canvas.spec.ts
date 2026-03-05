import { expect, test } from "@playwright/test";

function parseRgb(color: string): [number, number, number] | null {
  const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

test.describe("DirectoryIQ dark canvas", () => {
  test("authority blogs page does not render a white canvas", async ({ page }) => {
    await page.route("**/api/directoryiq/authority/blogs", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, blogs: [] }),
      });
    });

    await page.goto("/directoryiq/authority/blogs", { waitUntil: "networkidle" });
    await expect(page.getByText("No blog nodes found yet. Run Blog Ingestion from Overview.")).toBeVisible();

    const canvasBg = await page.evaluate(() => {
      const root = document.querySelector(".ecomviper-hud") ?? document.body;
      return window.getComputedStyle(root).backgroundColor;
    });
    expect(canvasBg).not.toBe("rgb(255, 255, 255)");

    const rgb = parseRgb(canvasBg);
    expect(rgb).not.toBeNull();
    const [r, g, b] = rgb as [number, number, number];
    const nearWhiteThreshold = 240;
    expect(r).toBeLessThan(nearWhiteThreshold);
    expect(g).toBeLessThan(nearWhiteThreshold);
    expect(b).toBeLessThan(nearWhiteThreshold);
  });
});
