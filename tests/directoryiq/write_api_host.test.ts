import { afterEach, describe, expect, it } from "vitest";
import { buildDirectoryIqWriteApiUrl, resolveDirectoryIqWriteApiBase } from "@/lib/directoryiq/writeApiHost";

const ORIGINAL_NEXT_PUBLIC_DIRECTORYIQ_API_BASE = process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE;

afterEach(() => {
  if (typeof ORIGINAL_NEXT_PUBLIC_DIRECTORYIQ_API_BASE === "string") {
    process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE = ORIGINAL_NEXT_PUBLIC_DIRECTORYIQ_API_BASE;
  } else {
    delete process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE;
  }
});

describe("directoryiq write api host", () => {
  it("defaults to canonical runtime owner host", () => {
    delete process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE;
    expect(resolveDirectoryIqWriteApiBase()).toBe("https://directoryiq-api.ibrains.ai");
  });

  it("builds canonical write urls with normalized query", () => {
    process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE = "http://127.0.0.1:3001/";
    expect(buildDirectoryIqWriteApiUrl("/api/directoryiq/jobs/djq_abc", "?site_id=site-1")).toBe(
      "http://127.0.0.1:3001/api/directoryiq/jobs/djq_abc?site_id=site-1"
    );
  });

  it("uses same-origin relative write urls in browser context", () => {
    process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";
    const originalWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {};

    try {
      expect(buildDirectoryIqWriteApiUrl("/api/directoryiq/jobs/djq_abc", "?site_id=site-1")).toBe(
        "/api/directoryiq/jobs/djq_abc?site_id=site-1"
      );
    } finally {
      if (typeof originalWindow === "undefined") {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = originalWindow;
      }
    }
  });
});
