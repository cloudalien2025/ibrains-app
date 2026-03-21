import { afterEach, describe, expect, it } from "vitest";
import { buildStep2DraftApiUrl, resolveStep2DraftDirectoryIqApiBase } from "@/lib/directoryiq/step2DraftApiHost";

const ORIGINAL_NEXT_PUBLIC_DIRECTORYIQ_API_BASE = process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE;

afterEach(() => {
  if (typeof ORIGINAL_NEXT_PUBLIC_DIRECTORYIQ_API_BASE === "string") {
    process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE = ORIGINAL_NEXT_PUBLIC_DIRECTORYIQ_API_BASE;
  } else {
    delete process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE;
  }
});

describe("step2 draft api host ownership", () => {
  it("defaults to canonical DirectoryIQ API host", () => {
    delete process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE;

    expect(resolveStep2DraftDirectoryIqApiBase()).toBe("https://directoryiq-api.ibrains.ai");
    expect(buildStep2DraftApiUrl("15", 3, "?site_id=abc")).toBe(
      "https://directoryiq-api.ibrains.ai/api/directoryiq/listings/15/authority/3/draft?site_id=abc"
    );
  });

  it("uses explicit NEXT_PUBLIC_DIRECTORYIQ_API_BASE when provided", () => {
    process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE = "http://127.0.0.1:3001/";

    expect(buildStep2DraftApiUrl("15", 3, "site_id=abc")).toBe(
      "http://127.0.0.1:3001/api/directoryiq/listings/15/authority/3/draft?site_id=abc"
    );
  });
});
