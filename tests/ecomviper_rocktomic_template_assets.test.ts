import { describe, expect, it } from "vitest";
import { extractRocktomicTemplateAssets } from "@/lib/ecomviper/suppliers/rocktomic-template-assets";

const htmlFixture = `
<html>
  <body>
    <div data-sku="ROC011">
      <a href="https://rocktomicplatform.blob.core.windows.net/roc011/ROC011.ai">ROC011.ai</a>
      <a href="https://rocktomicplatform.blob.core.windows.net/roc011/ROC011.tif">ROC011.tif</a>
      <span>Last-Modified: Mon, 12 Aug 2024 18:00:53 GMT</span>
    </div>
    <div data-sku="ROC012">
      <a href="https://rocktomicplatform.blob.core.windows.net/roc012/ROC012.ai">ROC012.ai</a>
    </div>
  </body>
</html>
`;

describe("rocktomic template asset extraction", () => {
  it("extracts .ai and .tif template assets by SKU", () => {
    const result = extractRocktomicTemplateAssets({
      html: htmlFixture,
      sourcePageUrl: "https://rocktomicplatform.blob.core.windows.net/client-resources/templates.html",
    });

    const roc011 = result.assetsBySku.find((entry) => entry.sku === "ROC011");
    expect(roc011?.templateAssets.labelTemplateAi?.url).toContain("ROC011.ai");
    expect(roc011?.templateAssets.mockupTemplateTif?.url).toContain("ROC011.tif");
    expect(roc011?.assetReadiness.readyForOptiPixelAssets).toBe(true);

    const roc012 = result.assetsBySku.find((entry) => entry.sku === "ROC012");
    expect(roc012?.assetReadiness.hasLabelTemplateAi).toBe(true);
    expect(roc012?.assetReadiness.hasMockupTemplateTif).toBe(false);
    expect(roc012?.defects).toContain("missing_mockup_template_tif");
  });

  it("captures file metadata and source details", () => {
    const result = extractRocktomicTemplateAssets({
      html: htmlFixture,
      sourcePageUrl: "https://rocktomicplatform.blob.core.windows.net/client-resources/templates.html",
    });

    const labelEvidence = result.evidence.find((entry) => entry.fileName === "ROC011.ai");
    expect(labelEvidence?.format).toBe("ai");
    expect(labelEvidence?.fileType).toBe("Label Template");
    expect(labelEvidence?.lastUpdated).toContain("GMT");
    expect(labelEvidence?.source).toBe("templates_page");
  });
});
