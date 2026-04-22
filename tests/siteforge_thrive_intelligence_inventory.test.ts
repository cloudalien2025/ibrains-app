import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverThriveIntelligence, inferThriveSymbolRole } from "@/lib/siteforge/thriveIntelligence";
import { ConnectionProfile } from "@/lib/siteforge/contracts";

function jsonResponse(payload: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      ...(headers ?? {}),
    },
  });
}

const connection: ConnectionProfile = {
  id: "conn_1",
  label: "WP",
  baseUrl: "https://example.com",
  username: "siteforge_bot",
  appPassword: "pw",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("siteforge thrive intelligence inventory", () => {
  it("normalizes active skin, symbol roles, and primitive counts from safe GET surfaces", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.endsWith("/wp-json/wp/v2/settings")) {
        return jsonResponse({ show_on_front: "page", page_on_front: 65 });
      }
      if (url.includes("/wp-json/wp/v2/thrive_skin_tax")) {
        return jsonResponse([
          { id: 7, name: "Default Theme", slug: "default-theme", tag: "default", is_active: "0" },
          { id: 8, name: "Shapeshift Theme", slug: "shapeshift-theme", tag: "q1qj01", is_active: "1" },
        ]);
      }
      if (url.includes("/wp-json/wp/v2/tcb_symbol")) {
        return jsonResponse([
          {
            id: 57,
            slug: "default-header-for-shapeshift-theme",
            title: { raw: "Default Header for Shapeshift Theme" },
            tcb_symbols_tax: [{ slug: "headers", name: "Headers" }],
            tve_updated_post: "<div>...</div>",
            tve_custom_css: ".x{}",
          },
          {
            id: 43,
            slug: "default-footer-for-shapeshift-theme",
            title: { raw: "Default Footer for Shapeshift Theme" },
            tcb_symbols_tax: [{ slug: "footers", name: "Footers" }],
            tve_updated_post: "<div>...</div>",
            tve_custom_css: "",
          },
        ]);
      }
      if (url.includes("/wp-json/wp/v2/thrive_template")) {
        return jsonResponse([{ id: 1 }], 200, { "x-wp-total": "19" });
      }
      if (url.includes("/wp-json/wp/v2/thrive_layout")) {
        return jsonResponse([{ id: 1 }], 200, { "x-wp-total": "5" });
      }
      if (url.includes("/wp-json/wp/v2/thrive_section")) {
        return jsonResponse([{ id: 1 }], 200, { "x-wp-total": "1" });
      }

      throw new Error(`Unhandled request ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const intel = await discoverThriveIntelligence(connection);

    expect(intel).toBeTruthy();
    expect(intel?.storageMode).toBe("wordpress-rest-readonly");
    expect(intel?.namespaces).toEqual([]);
    expect(intel?.mode).toBe("wp_safe_mode");
    expect(intel?.homepage.showOnFront).toBe("page");
    expect(intel?.homepage.pageOnFront).toBe(65);
    expect(intel?.activeSkin?.id).toBe(8);
    expect(intel?.symbolSummary).toEqual({ total: 2, headers: 1, footers: 1, sections: 0, unknown: 0 });
    expect(intel?.templates.length).toBe(1);
    expect(intel?.layouts.length).toBe(1);
    expect(intel?.sections.length).toBe(1);
    expect(intel?.primitiveCounts).toEqual({
      thriveTemplate: 19,
      thriveLayout: 5,
      thriveSection: 1,
      tcbSymbol: 2,
    });
    expect(intel?.discoveredCapabilities.hasTtbNamespace).toBe(false);
    expect(intel?.safeHints.frontPageUsesWpSettings).toBe(true);
    expect(intel?.symbolInventory[0]?.hasBuilderContent).toBe(true);
    expect(intel?.symbolInventory[0]?.contentHash).toBeTruthy();
    expect(intel?.symbolInventory[0]?.keywords?.length).toBeGreaterThan(0);
  });

  it("infers role fallback from title/slug when taxonomy is missing", () => {
    expect(inferThriveSymbolRole({ taxonomySlug: null, title: "Primary Header", slug: "symbol-1" })).toBe("header");
    expect(inferThriveSymbolRole({ taxonomySlug: null, title: "Site Footer", slug: "symbol-2" })).toBe("footer");
    expect(inferThriveSymbolRole({ taxonomySlug: null, title: "Reusable Section", slug: "symbol-3" })).toBe("section");
    expect(inferThriveSymbolRole({ taxonomySlug: null, title: "Reusable Block", slug: "symbol-4" })).toBe("unknown");
  });
});
