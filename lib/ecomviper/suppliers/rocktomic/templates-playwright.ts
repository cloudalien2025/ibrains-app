export interface TemplateLinkCandidate {
  href: string;
  text: string;
  provenance: string;
}

export interface TemplateExtractionResult {
  status: "not_run" | "ok" | "error";
  links: TemplateLinkCandidate[];
  warnings: string[];
}

export async function extractTemplateLinksWithPlaywright(input: {
  url: string;
  sku: string;
  enabled?: boolean;
}): Promise<TemplateExtractionResult> {
  if (!input.enabled) {
    return {
      status: "not_run",
      links: [],
      warnings: ["playwright_extraction_disabled"],
    };
  }

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(input.url, { waitUntil: "domcontentloaded" });

    const upperSku = input.sku.toUpperCase();
    const links = await page.$$eval("a[href]", (anchors, targetSku) => {
      return anchors
        .map((anchor) => {
          const text = (anchor.textContent || "").trim();
          const href = (anchor.getAttribute("href") || "").trim();
          return { text, href };
        })
        .filter((entry) => entry.text.toUpperCase().includes(targetSku) || entry.href.toUpperCase().includes(targetSku));
    }, upperSku);

    await browser.close();

    return {
      status: "ok",
      links: links.map((entry) => ({
        href: entry.href,
        text: entry.text,
        provenance: "playwright_templates_page",
      })),
      warnings: [],
    };
  } catch (error) {
    return {
      status: "error",
      links: [],
      warnings: [error instanceof Error ? error.message : String(error || "playwright_extraction_error")],
    };
  }
}
