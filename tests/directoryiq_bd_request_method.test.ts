import { afterEach, describe, expect, it, vi } from "vitest";
import { bdRequestForm } from "@/app/api/directoryiq/_utils/bdApi";
import {
  fetchBdWithMethodPreserved,
  resolveBdRequestMethod,
} from "@/app/api/directoryiq/_utils/bdRequestMethod";

function asHeaders(value: HeadersInit | undefined): Record<string, string> {
  if (!value) return {};
  if (value instanceof Headers) {
    const out: Record<string, string> = {};
    value.forEach((v, k) => {
      out[k.toLowerCase()] = v;
    });
    return out;
  }
  if (Array.isArray(value)) {
    return Object.fromEntries(value.map(([k, v]) => [k.toLowerCase(), String(v)]));
  }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k.toLowerCase(), String(v)]));
}

describe("directoryiq bd request method contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forces POST for BD search endpoints", () => {
    expect(resolveBdRequestMethod("/api/v2/users_portfolio_groups/search")).toBe("POST");
    expect(resolveBdRequestMethod("/api/v2/users_portfolio_groups/search", "GET")).toBe("POST");
    expect(resolveBdRequestMethod("/api/v2/data_posts/search")).toBe("POST");
    expect(resolveBdRequestMethod("/api/v2/data_posts/search", "GET")).toBe("POST");
  });

  it("builds BD search requests with POST, X-Api-Key and form body", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        return new Response(JSON.stringify({ status: "success", data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      })
    );

    await bdRequestForm({
      baseUrl: "https://example.com",
      apiKey: "secret",
      method: "GET",
      path: "/api/v2/users_portfolio_groups/search",
      form: { data_id: 75, limit: 1 },
    });
    await bdRequestForm({
      baseUrl: "https://example.com",
      apiKey: "secret",
      method: "GET",
      path: "/api/v2/data_posts/search",
      form: { data_id: 14, limit: 1 },
    });

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.init?.method).toBe("POST");
      const headers = asHeaders(call.init?.headers);
      expect(headers["x-api-key"]).toBe("secret");
      expect(headers["content-type"]).toBe("application/x-www-form-urlencoded");
      expect(call.init?.body instanceof URLSearchParams).toBe(true);
    }
  });

  it("preserves POST across redirects", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        if (calls.length === 1) {
          return new Response(null, {
            status: 302,
            headers: { location: "/api/v2/users_portfolio_groups/search" },
          });
        }
        return new Response(JSON.stringify({ status: "success", data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      })
    );

    const body = new URLSearchParams({ data_id: "75", limit: "1" });
    const response = await fetchBdWithMethodPreserved({
      url: "https://example.com/api/v2/users_portfolio_groups/search",
      method: "POST",
      headers: {
        "X-Api-Key": "secret",
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[1]?.init?.method).toBe("POST");
    expect(calls[1]?.init?.body instanceof URLSearchParams).toBe(true);
  });
});
