import { describe, expect, it } from "vitest";
import { assertSafeThriveReadRequest } from "@/lib/siteforge/thriveIntelligence";

describe("siteforge thrive read allowlist guard", () => {
  it("allows only safe GET routes", () => {
    expect(assertSafeThriveReadRequest("/wp-json/", "GET").ok).toBe(true);
    expect(assertSafeThriveReadRequest("/wp-json/wp/v2/settings", "GET").ok).toBe(true);
    expect(assertSafeThriveReadRequest("/wp-json/wp/v2/thrive_template?per_page=100", "GET").ok).toBe(true);
  });

  it("blocks writes and blocked Thrive namespaces", () => {
    expect(assertSafeThriveReadRequest("/wp-json/wp/v2/thrive_template", "POST").ok).toBe(false);
    expect(assertSafeThriveReadRequest("/wp-json/ttb/v1/template", "GET").ok).toBe(false);
    expect(assertSafeThriveReadRequest("/wp-json/tcb/v1/symbol", "GET").ok).toBe(false);
    expect(assertSafeThriveReadRequest("/wp-json/td/v1/api-tokens/generate", "GET").ok).toBe(false);
    expect(assertSafeThriveReadRequest("/wp-json/wp/v2/users", "GET").ok).toBe(false);
  });
});
