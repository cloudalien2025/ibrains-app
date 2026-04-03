import { describe, expect, it } from "vitest";
import {
  canonicalizePageUrl,
  parseYoutubeVideoId,
} from "@/lib/directoryiq/ingestion/contracts";
import { resolveDecision } from "@/lib/directoryiq/ingestion/engine";

describe("directoryiq multi-source identity rules", () => {
  it("normalizes web URLs for source identity", () => {
    const a = canonicalizePageUrl("HTTPS://Example.com/Path/?utm_source=newsletter&ref=x&id=123");
    const b = canonicalizePageUrl("https://example.com/Path?id=123");
    expect(a).toBe(b);
  });

  it("extracts stable youtube video ids", () => {
    expect(parseYoutubeVideoId("https://www.youtube.com/watch?v=abc123_XYZ")).toBe("abc123_XYZ");
    expect(parseYoutubeVideoId("https://youtu.be/abc123_XYZ?t=20")).toBe("abc123_XYZ");
    expect(parseYoutubeVideoId("https://www.youtube.com/shorts/abc123_XYZ")).toBe("abc123_XYZ");
  });
});

describe("directoryiq dedupe decision contract", () => {
  const current = { id: "doc_1", content_sha256: "hash_a", version_no: 1 };

  it("web_search unchanged is skipped", () => {
    expect(resolveDecision("web_search", current, "hash_a")).toBe("skip");
  });

  it("website_url unchanged is skipped on repeat ingest", () => {
    expect(resolveDecision("website_url", current, "hash_a")).toBe("skip");
  });

  it("website_url changed updates in place", () => {
    expect(resolveDecision("website_url", current, "hash_b")).toBe("update");
  });

  it("document upload changed versions", () => {
    expect(resolveDecision("document_upload", current, "hash_b")).toBe("version");
  });

  it("document upload unchanged is skipped on repeat ingest", () => {
    expect(resolveDecision("document_upload", current, "hash_a")).toBe("skip");
  });

  it("youtube changed follows version semantics from existing ingest behavior", () => {
    expect(resolveDecision("youtube", current, "hash_b")).toBe("version");
  });

  it("youtube unchanged is skipped on repeat ingest", () => {
    expect(resolveDecision("youtube", current, "hash_a")).toBe("skip");
  });

  it("new source creates", () => {
    expect(resolveDecision("web_search", null, "hash_new")).toBe("create");
  });
});
