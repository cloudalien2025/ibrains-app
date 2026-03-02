export type StoryboardCapture = {
  screenshot: Buffer;
  visibleText: string;
};

export async function captureStoryboard(url: string): Promise<StoryboardCapture> {
  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch (e) {
    throw new Error("PLAYWRIGHT_NOT_INSTALLED");
  }

  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    const visibleText = await page.evaluate(
      () => document.body?.innerText || ""
    );
    const screenshot = await page.screenshot({ fullPage: true, type: "png" });
    return { screenshot, visibleText };
  } finally {
    await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}
