import { describe, it, expect } from "vitest";
import { parseTemplatesHtml } from "@/lib/ecomviper/suppliers/rocktomic/templates-html-parser";

const SOURCE_URL = "https://rocktomicplatform.blob.core.windows.net/client-resources/templates.html";

const SAMPLE_HTML_WITH_LINKS = `
<!DOCTYPE html>
<html>
<body>
  <h1>Label Templates</h1>
  <a href="https://rocktomicplatform.blob.core.windows.net/roc010/ROC010.ai">ROC010 Label Template</a>
  <a href="https://rocktomicplatform.blob.core.windows.net/roc010/ROC010.tif">ROC010 Mockup</a>
  <a href="https://rocktomicplatform.blob.core.windows.net/roc020/ROC020.ai">ROC020 Label Template</a>
  <a href="https://rocktomicplatform.blob.core.windows.net/roc020/ROC020.tif">ROC020 Mockup</a>
</body>
</html>
`;

const JS_DRIVEN_HTML = `
<!DOCTYPE html>
<html>
<body>
<script>
  // Dynamic content loaded via JavaScript
  fetch('/api/templates').then(r => r.json()).then(data => { /* render */ });
</script>
</body>
</html>
`;

describe("parseTemplatesHtml", () => {
  it("extracts label (.ai) and mockup (.tif) links from static HTML", () => {
    const result = parseTemplatesHtml(SAMPLE_HTML_WITH_LINKS, SOURCE_URL);
    expect(result.status).toBe("ok");
    expect(result.totalLinks).toBe(4);
  });

  it("maps extracted links to SKUs", () => {
    const result = parseTemplatesHtml(SAMPLE_HTML_WITH_LINKS, SOURCE_URL);
    expect(result.skuLinkMap["ROC010"]).toBeDefined();
    expect(result.skuLinkMap["ROC010"].labelUrl).toContain("ROC010.ai");
    expect(result.skuLinkMap["ROC010"].mockupUrl).toContain("ROC010.tif");
    expect(result.skuLinkMap["ROC020"]).toBeDefined();
    expect(result.skuLinkMap["ROC020"].labelUrl).toContain("ROC020.ai");
  });

  it("classifies .ai links as label_ai type", () => {
    const result = parseTemplatesHtml(SAMPLE_HTML_WITH_LINKS, SOURCE_URL);
    const aiLinks = result.extractedLinks.filter((l) => l.type === "label_ai");
    expect(aiLinks.length).toBeGreaterThan(0);
    for (const link of aiLinks) {
      expect(link.url).toMatch(/\.ai(\?.*)?$/);
    }
  });

  it("classifies .tif links as mockup_tif type", () => {
    const result = parseTemplatesHtml(SAMPLE_HTML_WITH_LINKS, SOURCE_URL);
    const tifLinks = result.extractedLinks.filter((l) => l.type === "mockup_tif");
    expect(tifLinks.length).toBeGreaterThan(0);
    for (const link of tifLinks) {
      expect(link.url).toMatch(/\.tif(\?.*)?$/);
    }
  });

  it("returns no_static_links status and warning for JS-driven page", () => {
    const result = parseTemplatesHtml(JS_DRIVEN_HTML, SOURCE_URL);
    expect(result.status).toBe("no_static_links");
    expect(result.totalLinks).toBe(0);
    expect(result.warnings.some((w) => w.includes("Playwright"))).toBe(true);
  });

  it("returns empty status for empty HTML", () => {
    const result = parseTemplatesHtml("", SOURCE_URL);
    expect(result.status).toBe("empty");
    expect(result.warnings).toContain("empty_html_content");
  });

  it("does not assign sku to links without a ROC pattern in the URL", () => {
    const html = `<a href="https://example.com/generic-template.ai">Generic</a>`;
    const result = parseTemplatesHtml(html, SOURCE_URL);
    const nullSkuLinks = result.extractedLinks.filter((l) => l.sku === null);
    expect(nullSkuLinks.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("links_without_sku_mapping"))).toBe(true);
  });

  it("resolves relative URLs against the source URL", () => {
    const html = `<a href="/roc010/ROC010.ai">ROC010</a>`;
    const result = parseTemplatesHtml(html, SOURCE_URL);
    if (result.status === "ok") {
      expect(result.extractedLinks[0].url).toMatch(/^https?:\/\//);
    }
  });
});
