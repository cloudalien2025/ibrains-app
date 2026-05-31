import { describe, expect, it } from "vitest";
import {
  detectAiCompatibility,
  extractPdfCompatibleAiText,
  extractRocktomicAiLabelTextForSku,
  maskAssetUrlForLogs,
  normalizeTemplateLastUpdated,
  parseSupplementFactsFromAiText,
  readRemoteAssetMetadata,
  shouldDownloadForExtraction,
  type RocktomicAiLabelTextEvidenceRecord,
} from "@/lib/ecomviper/suppliers/rocktomic-ai-label-text";

const PDF_LABEL_FIXTURE = `%PDF-1.6
1 0 obj
<< /Length 320 >>
stream
BT
(Supplement Facts) Tj
(Serving Size: One Scoop 12.5 g) Tj
(Servings Per Container: 25) Tj
(Ingredients: Niacin 36 mg; Vitamin B6 2 mg; Citrulline Malate 5000 mg) Tj
(Other Ingredients: Citric Acid, Natural Flavor) Tj
(Directions: Mix one scoop with water before training.) Tj
(Warnings: Keep out of reach of children.) Tj
ET
endstream
endobj
%%EOF`;

describe("rocktomic AI label text extraction", () => {
  it("detects %PDF header as pdf_compatible", () => {
    const bytes = Buffer.from(PDF_LABEL_FIXTURE, "latin1");
    expect(detectAiCompatibility(bytes)).toBe("pdf_compatible");
  });

  it("detects non-PDF AI as non_pdf_ai", () => {
    const bytes = Buffer.from("AI_BINARY_HEADER", "latin1");
    expect(detectAiCompatibility(bytes)).toBe("non_pdf_ai");
  });

  it("extracts text and parses supplement facts from pdf-compatible AI content", () => {
    const raw = extractPdfCompatibleAiText(Buffer.from(PDF_LABEL_FIXTURE, "latin1"));
    const parsed = parseSupplementFactsFromAiText(raw);

    expect(parsed.parsedFacts.servingSize).toContain("One Scoop");
    expect(parsed.parsedFacts.servingsPerContainer).toBe("25");
    expect(parsed.parsedFacts.amountPerServing.some((entry) => entry.includes("Niacin 36 mg"))).toBe(true);
    expect(parsed.parsedFacts.otherIngredients).toContain("Citric Acid");
    expect(parsed.parsedFacts.directions).toContain("Mix one scoop");
    expect(parsed.parsedFacts.warnings).toContain("Keep out of reach");
    expect(parsed.parseWarnings).not.toContain("missing_serving_size");
  });

  it("captures remote metadata headers and normalizes template-page last updated", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("", {
        status: 200,
        headers: {
          etag: '"abc123"',
          "last-modified": "Mon, 12 Aug 2024 18:00:53 GMT",
          "content-length": "3544180",
          "content-type": "application/postscript",
        },
      });

    const metadata = await readRemoteAssetMetadata({
      url: "https://rocktomicplatform.blob.core.windows.net/roc011/ROC011.ai",
      fileName: "ROC011.ai",
      templatePageLastUpdated: "Mon, 12 Aug 2024 18:00:53 GMT",
      fetchImpl,
    });

    expect(metadata.httpEtag).toBe('"abc123"');
    expect(metadata.httpLastModified).toContain("GMT");
    expect(metadata.httpContentLength).toBe(3544180);
    expect(metadata.httpContentType).toContain("application");
    expect(metadata.templatePageLastUpdated).toContain("GMT");
  });

  it("skips download when metadata unchanged and prior extraction exists", () => {
    const previous = {
      sku: "ROC011",
      url: "https://rocktomicplatform.blob.core.windows.net/roc011/ROC011.ai",
      fileName: "ROC011.ai",
      format: "ai",
      assetRole: "label_template",
      templatePageLastUpdated: "Mon, 12 Aug 2024 18:00:53 GMT",
      httpEtag: '"same"',
      httpLastModified: "Mon, 12 Aug 2024 18:00:53 GMT",
      httpContentLength: 10,
      httpContentType: "application/postscript",
      lastCheckedAt: "2026-05-31T00:00:00.000Z",
      source: "templates_page",
      compatibility: "pdf_compatible",
      extractionStatus: "success",
      extractedAt: "2026-05-31T00:00:01.000Z",
      extractionMethod: "ai_pdf_text",
      tempDownloadedBytes: 10,
      rawText: "Supplement Facts",
      normalizedLabelText: "Supplement Facts",
      parsedFacts: {
        servingSize: "1 Scoop",
        servingsPerContainer: "30",
        activeIngredients: ["A"],
        amountPerServing: ["A 100mg"],
        dailyValuePercentages: [],
        otherIngredients: ["B"],
        directions: null,
        warnings: null,
        storage: null,
      },
      confidence: "high",
      needsReview: false,
      parseWarnings: [],
      errorDetail: null,
    } satisfies RocktomicAiLabelTextEvidenceRecord;

    const shouldDownload = shouldDownloadForExtraction(previous, {
      url: previous.url,
      fileName: previous.fileName,
      format: "ai",
      assetRole: "label_template",
      templatePageLastUpdated: previous.templatePageLastUpdated,
      httpEtag: previous.httpEtag,
      httpLastModified: previous.httpLastModified,
      httpContentLength: previous.httpContentLength,
      httpContentType: previous.httpContentType,
      lastCheckedAt: "2026-06-01T00:00:00.000Z",
      source: "templates_page",
    });

    expect(shouldDownload).toBe(false);
  });

  it("requires refresh when etag changed", () => {
    const previous = {
      sku: "ROC011",
      url: "https://rocktomicplatform.blob.core.windows.net/roc011/ROC011.ai",
      fileName: "ROC011.ai",
      format: "ai",
      assetRole: "label_template",
      templatePageLastUpdated: "Mon, 12 Aug 2024 18:00:53 GMT",
      httpEtag: '"old"',
      httpLastModified: "Mon, 12 Aug 2024 18:00:53 GMT",
      httpContentLength: 10,
      httpContentType: "application/postscript",
      lastCheckedAt: "2026-05-31T00:00:00.000Z",
      source: "templates_page",
      compatibility: "pdf_compatible",
      extractionStatus: "success",
      extractedAt: "2026-05-31T00:00:01.000Z",
      extractionMethod: "ai_pdf_text",
      tempDownloadedBytes: 10,
      rawText: "Supplement Facts",
      normalizedLabelText: "Supplement Facts",
      parsedFacts: {
        servingSize: "1 Scoop",
        servingsPerContainer: "30",
        activeIngredients: ["A"],
        amountPerServing: ["A 100mg"],
        dailyValuePercentages: [],
        otherIngredients: ["B"],
        directions: null,
        warnings: null,
        storage: null,
      },
      confidence: "high",
      needsReview: false,
      parseWarnings: [],
      errorDetail: null,
    } satisfies RocktomicAiLabelTextEvidenceRecord;

    const shouldDownload = shouldDownloadForExtraction(previous, {
      url: previous.url,
      fileName: previous.fileName,
      format: "ai",
      assetRole: "label_template",
      templatePageLastUpdated: previous.templatePageLastUpdated,
      httpEtag: '"new"',
      httpLastModified: previous.httpLastModified,
      httpContentLength: previous.httpContentLength,
      httpContentType: previous.httpContentType,
      lastCheckedAt: "2026-06-01T00:00:00.000Z",
      source: "templates_page",
    });

    expect(shouldDownload).toBe(true);
  });

  it("returns success evidence for AI extraction and does not expose query parameters in logs", async () => {
    const fetchImpl: typeof fetch = async (url, init) => {
      if (init?.method === "HEAD") {
        return new Response("", {
          status: 200,
          headers: { etag: '"etag-value"', "content-type": "application/pdf", "content-length": "1024" },
        });
      }
      return new Response(PDF_LABEL_FIXTURE, { status: 200, headers: { "content-type": "application/pdf" } });
    };

    const result = await extractRocktomicAiLabelTextForSku({
      sku: "roc-011",
      assetUrl: "https://rocktomicplatform.blob.core.windows.net/roc011/ROC011.ai?sig=SECRET",
      fileName: "ROC011.ai",
      templatePageLastUpdated: "Mon, 12 Aug 2024 18:00:53 GMT",
      fetchImpl,
    });

    expect(result.sku).toBe("ROC011");
    expect(result.extractionStatus).toBe("success");
    expect(result.extractionMethod).toBe("ai_pdf_text");
    expect(result.parsedFacts?.servingSize).toContain("One Scoop");
    expect(maskAssetUrlForLogs(result.url)).not.toContain("sig=");
  });

  it("reuses previous extraction when GET returns 304 not modified", async () => {
    const previous = {
      sku: "ROC011",
      url: "https://rocktomicplatform.blob.core.windows.net/roc011/ROC011.ai",
      fileName: "ROC011.ai",
      format: "ai",
      assetRole: "label_template",
      templatePageLastUpdated: "Mon, 12 Aug 2024 18:00:53 GMT",
      httpEtag: '"etag-value"',
      httpLastModified: "Mon, 12 Aug 2024 18:00:53 GMT",
      httpContentLength: 1024,
      httpContentType: "application/pdf",
      lastCheckedAt: "2026-05-31T00:00:00.000Z",
      source: "templates_page",
      compatibility: "pdf_compatible",
      extractionStatus: "success",
      extractedAt: "2026-05-31T00:00:01.000Z",
      extractionMethod: "ai_pdf_text",
      tempDownloadedBytes: 1024,
      rawText: "Supplement Facts",
      normalizedLabelText: "Supplement Facts",
      parsedFacts: {
        servingSize: "1 Scoop",
        servingsPerContainer: "30",
        activeIngredients: ["A"],
        amountPerServing: ["A 100mg"],
        dailyValuePercentages: [],
        otherIngredients: ["B"],
        directions: null,
        warnings: null,
        storage: null,
      },
      confidence: "high",
      needsReview: false,
      parseWarnings: [],
      errorDetail: null,
    } satisfies RocktomicAiLabelTextEvidenceRecord;

    const fetchImpl: typeof fetch = async (_url, init) => {
      if (init?.method === "HEAD") {
        return new Response("", {
          status: 200,
          headers: { etag: '"etag-value"', "content-type": "application/pdf", "content-length": "1024" },
        });
      }
      return new Response(null, { status: 304 });
    };

    const result = await extractRocktomicAiLabelTextForSku({
      sku: "ROC011",
      assetUrl: previous.url,
      fileName: previous.fileName,
      templatePageLastUpdated: previous.templatePageLastUpdated,
      previousEvidence: previous,
      forceRefresh: true,
      fetchImpl,
    });

    expect(result.extractionStatus).toBe("reused_cached");
    expect(result.reusedFromPreviousBuild).toBe(true);
    expect(result.extractionSkippedReason).toBe("http_not_modified_304");
  });

  it("normalizes template last updated and handles malformed values", () => {
    expect(normalizeTemplateLastUpdated("Mon, 12 Aug 2024 18:00:53 GMT")).toContain("GMT");
    expect(normalizeTemplateLastUpdated("not-a-date")).toBe("not-a-date");
    expect(normalizeTemplateLastUpdated(null)).toBeNull();
  });
});
