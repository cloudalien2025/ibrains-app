import { describe, expect, it } from "vitest";
import { extractTemplateLinksWithPlaywright } from "@/lib/ecomviper/suppliers/rocktomic/templates-playwright";

describe("templates playwright foundation", () => {
  it("returns not_run by default without browser execution", async () => {
    const result = await extractTemplateLinksWithPlaywright({
      url: "https://example.com/templates.html",
      sku: "ROC948",
      enabled: false,
    });

    expect(result.status).toBe("not_run");
    expect(result.links).toEqual([]);
    expect(result.warnings).toContain("playwright_extraction_disabled");
  });
});
