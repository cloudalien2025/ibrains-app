import { describe, expect, it } from "vitest";
import { extractRocktomicCatalogLinkEvidence } from "@/lib/ecomviper/suppliers/rocktomic-pdf-assets";

function buildPdfFixture(): ArrayBuffer {
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Page /Contents [2 0 R] /Annots [5 0 R 6 0 R 7 0 R 8 0 R] >>
endobj
2 0 obj
<< >>
stream
BT
(ROC011) Tj
(Cert. of Analysis: Click HERE) Tj
(Label & 3D Mockup Template: Click HERE) Tj
(Wholesale Pricing Click HERE) Tj
(Reference Link Click HERE) Tj
ET
endstream
endobj
5 0 obj
<< /Subtype /Link /Rect [100 100 120 120] /A << /URI (https://example.com/roc011-coa.pdf) >> >>
endobj
6 0 obj
<< /Subtype /Link /Rect [130 100 150 120] /A << /URI (https://rocktomicplatform.blob.core.windows.net/client-resources/templates.html) >> >>
endobj
7 0 obj
<< /Subtype /Link /Rect [160 100 180 120] /A << /URI (https://docs.google.com/spreadsheets/d/abc/edit) >> >>
endobj
8 0 obj
<< /Subtype /Link /Rect [190 100 210 120] /A << /URI (https://example.com/unclassified-link) >> >>
endobj
trailer <<>>
%%EOF`;
  const bytes = Buffer.from(pdf, "latin1");
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe("rocktomic pdf asset extraction", () => {
  it("maps COA/template/pricing links and preserves page/coordinate evidence", () => {
    const result = extractRocktomicCatalogLinkEvidence({ pdfBytes: buildPdfFixture() });

    expect(result.counts.linksDetected).toBe(4);
    expect(result.skuMappings).toHaveLength(1);

    const sku = result.skuMappings[0];
    expect(sku.sku).toBe("ROC011");
    expect(sku.links.coaUrl).toContain("roc011-coa.pdf");
    expect(sku.links.labelAnd3dMockupTemplateUrl).toContain("templates.html");
    expect(sku.links.pricingSheetUrl).toContain("docs.google.com");

    const coaEvidence = sku.linkEvidence.find((row) => row.field === "coaUrl");
    expect(coaEvidence?.page).toBe(1);
    expect(coaEvidence?.rect).toEqual([100, 100, 120, 120]);
    expect(coaEvidence?.confidence).toBe("high");
  });

  it("keeps unclassified links as unknownLink evidence", () => {
    const result = extractRocktomicCatalogLinkEvidence({ pdfBytes: buildPdfFixture() });
    const unknown = result.evidence.find((row) => row.url.includes("unclassified-link"));

    expect(unknown?.field).toBe("unknownLink");
    expect(result.counts.unknownLinks).toBe(1);
  });

  it("does not treat pricing sheet link as SKU-specific pricing value", () => {
    const result = extractRocktomicCatalogLinkEvidence({ pdfBytes: buildPdfFixture() });
    const sku = result.skuMappings[0];

    expect(sku.links.pricingSheetUrl).toContain("spreadsheets");
    expect(sku.links.coaUrl).not.toContain("spreadsheets");
    expect(sku.links.labelAnd3dMockupTemplateUrl).not.toContain("spreadsheets");
  });
});
