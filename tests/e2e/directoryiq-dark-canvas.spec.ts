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
    await expect(page.getByRole("heading", { name: "Blog Content Layer" })).toBeVisible();

    const bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).not.toBe("rgb(255, 255, 255)");

    const rgb = parseRgb(bodyBg);
    expect(rgb).not.toBeNull();
    const [r, g, b] = rgb as [number, number, number];
    const nearWhiteThreshold = 240;
    expect(r).toBeLessThan(nearWhiteThreshold);
    expect(g).toBeLessThan(nearWhiteThreshold);
    expect(b).toBeLessThan(nearWhiteThreshold);
  });
});
