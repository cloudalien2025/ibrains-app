import { describe, it, expect } from "vitest";
import { parseDocxPolicy } from "@/lib/ecomviper/suppliers/rocktomic/docx-policy-parser";

const POLICY_URL = "https://rocktomicplatform.blob.core.windows.net/client-resources/Order-Refund-Policy-Template.docx?t=1780083599627";

describe("parseDocxPolicy", () => {
  it("returns parsed=false and warning when no buffer is provided", async () => {
    const result = await parseDocxPolicy({ sourceUrl: POLICY_URL });
    expect(result.parsed).toBe(false);
    expect(result.sourceUrl).toBe(POLICY_URL);
    expect(result.sections).toHaveLength(0);
    expect(result.fullText).toBeNull();
    expect(result.warnings.some((w) => w.includes("docx_buffer_unavailable"))).toBe(true);
  });

  it("returns parsed=false with mammoth_unavailable warning when mammoth is not installed", async () => {
    // mammoth is not in package.json - this fallback should fire
    const fakeBuffer = Buffer.from("PK...\x00\x00"); // not a real DOCX
    const result = await parseDocxPolicy({ docxBuffer: fakeBuffer, sourceUrl: POLICY_URL });
    expect(result.parsed).toBe(false);
    expect(result.warnings.some((w) => w.includes("docx_parser_unavailable") || w.includes("mammoth"))).toBe(true);
    expect(result.parserUsed).toBeNull();
  });

  it("preserves sourceUrl even when parsing fails", async () => {
    const result = await parseDocxPolicy({ sourceUrl: POLICY_URL });
    expect(result.sourceUrl).toBe(POLICY_URL);
  });

  it("returns null sections and normalizedSummary when not parsed", async () => {
    const result = await parseDocxPolicy({ sourceUrl: POLICY_URL });
    expect(result.sections).toHaveLength(0);
    expect(result.normalizedSummary).toBeNull();
  });

  it("does not throw when buffer is provided but unparseable", async () => {
    const badBuffer = Buffer.from("not a docx file contents");
    await expect(parseDocxPolicy({ docxBuffer: badBuffer, sourceUrl: POLICY_URL })).resolves.toBeDefined();
  });

  it("returns parsed=false when local path file does not exist", async () => {
    const result = await parseDocxPolicy({
      localPath: "/nonexistent/path/to/policy.docx",
      sourceUrl: POLICY_URL,
    });
    expect(result.parsed).toBe(false);
    expect(result.warnings.some((w) => w.includes("local_file_read_failed") || w.includes("buffer_unavailable"))).toBe(true);
  });
});
