import { describe, expect, it } from "vitest";
import {
  extractRocktomicTemplateAssets,
  extractRocktomicTemplateAssetsFromTemplatesPage,
} from "@/lib/ecomviper/suppliers/rocktomic-template-assets";

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

  it("extracts per-SKU .ai/.tif from templates page azure container/blob listing", async () => {
    const listContainersXml = `<?xml version="1.0" encoding="utf-8"?><EnumerationResults><Containers><Container><Name>roc011</Name></Container><Container><Name>roc012</Name></Container></Containers><NextMarker /></EnumerationResults>`;
    const roc011BlobsXml = `<?xml version="1.0" encoding="utf-8"?><EnumerationResults><Blobs><Blob><Name>ROC011.ai</Name><Properties><Last-Modified>Mon, 12 Aug 2024 18:00:53 GMT</Last-Modified></Properties></Blob><Blob><Name>ROC011.tif</Name><Properties><Last-Modified>Mon, 12 Aug 2024 18:00:58 GMT</Last-Modified></Properties></Blob></Blobs><NextMarker /></EnumerationResults>`;
    const roc012BlobsXml = `<?xml version="1.0" encoding="utf-8"?><EnumerationResults><Blobs><Blob><Name>ROC012.ai</Name><Properties><Last-Modified>Mon, 12 Aug 2024 18:05:00 GMT</Last-Modified></Properties></Blob></Blobs><NextMarker /></EnumerationResults>`;

    const html = `
      <html><body>
        <script>
          var blobUri = "https://rocktomicplatform.blob.core.windows.net";
          var sas = "?sv=test&sig=test";
        </script>
      </body></html>
    `;

    const fetchImpl: typeof fetch = async (url) => {
      const asText = String(url);
      if (asText.includes("comp=list") && asText.includes("prefix=roc")) {
        return new Response(listContainersXml, { status: 200 });
      }
      if (asText.includes("/roc011?")) {
        return new Response(roc011BlobsXml, { status: 200 });
      }
      if (asText.includes("/roc012?")) {
        return new Response(roc012BlobsXml, { status: 200 });
      }
      return new Response("not found", { status: 404 });
    };

    const result = await extractRocktomicTemplateAssetsFromTemplatesPage({
      html,
      sourcePageUrl: "https://rocktomicplatform.blob.core.windows.net/client-resources/templates.html",
      fetchImpl,
    });

    expect(result.counts.containersListed).toBe(2);
    expect(result.counts.blobAssetsScanned).toBe(3);
    expect(result.counts.labelTemplatesFound).toBe(2);
    expect(result.counts.mockupTemplatesFound).toBe(1);
    expect(result.assetsBySku.find((entry) => entry.sku === "ROC011")?.assetReadiness.readyForOptiPixelAssets).toBe(true);
    expect(result.assetsBySku.find((entry) => entry.sku === "ROC012")?.defects).toContain("missing_mockup_template_tif");
  });
});
