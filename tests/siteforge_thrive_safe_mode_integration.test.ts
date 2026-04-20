import { afterEach, describe, expect, it, vi } from "vitest";
import { applyThriveMappings } from "@/lib/siteforge/thrive";
import { executeBuildSpecToWordPress } from "@/lib/siteforge/wordpress/service";
import { BuildSpec, ConnectionProfile, ThriveIntelligence } from "@/lib/siteforge/contracts";
import { getThriveExecutionRuntime } from "@/lib/siteforge/thriveNativeHarness";

function json(payload: unknown, status = 200, headers?: Record<string, string>): Response {
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
  username: "bot",
  appPassword: "pw",
};

const spec: BuildSpec = {
  siteTitle: "Acme",
  homepageSlug: "home",
  menu: [{ label: "Home", slug: "home" }],
  pages: [
    {
      pageId: "p_home",
      title: "Home",
      slug: "home",
      purpose: "home",
      sections: [{ id: "s1", type: "hero", heading: "Hero", body: "Body", metadata: {} }],
      metadata: { template: "landing" },
    },
  ],
  metadata: {
    conversionFocus: "high",
    thriveAware: false,
    createdAt: "2026-04-20T00:00:00.000Z",
  },
};

const intelligence: ThriveIntelligence = {
  source: "wordpress_rest_get",
  collectedAt: "2026-04-20T00:00:00.000Z",
  mode: "wp_safe_mode",
  activeSkin: { id: 8, name: "Shapeshift", slug: "shapeshift", tag: "q1" },
  symbolInventory: [
    {
      id: 57,
      title: "Default Header",
      slug: "default-header",
      taxonomy: { slug: "headers", name: "Headers" },
      inferredRole: "header",
      reusable: true,
      hasBuilderContent: true,
      hasCustomCss: false,
      contentHash: "h1",
      cssHash: null,
      keywords: ["header"],
    },
  ],
  symbolSummary: { total: 1, headers: 1, footers: 0, sections: 0, unknown: 0 },
  primitiveCounts: { thriveTemplate: 1, thriveLayout: 1, thriveSection: 1, tcbSymbol: 1 },
  safeHints: { frontPageUsesWpSettings: true },
  warnings: [],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("siteforge thrive safe-mode integration", () => {
  it("resolves symbols while keeping execution on WordPress-safe endpoints", async () => {
    const translated = applyThriveMappings(spec, true, intelligence);

    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        calls.push(`${init?.method ?? "GET"} ${url}`);

        if (url.includes("/wp-json/wp/v2/pages?") && (!init?.method || init.method === "GET")) {
          return json([], 200, { "x-wp-total": "0" });
        }
        if (url.endsWith("/wp-json/wp/v2/settings") && (!init?.method || init.method === "GET")) {
          return json({ show_on_front: "posts", page_on_front: 0 });
        }
        if (url.endsWith("/wp-json/wp/v2/pages") && init?.method === "POST") {
          return json({ id: 101, link: "https://example.com/home", status: "publish" });
        }
        if (url.endsWith("/wp-json/wp/v2/settings") && init?.method === "POST") {
          return json({ show_on_front: "page", page_on_front: 101 });
        }
        if (url.endsWith("/wp-json/wp/v2/menus") && init?.method === "POST") {
          return json({ id: 55 });
        }
        if (url.endsWith("/wp-json/wp/v2/menu-items") && init?.method === "POST") {
          return json({ id: 99 });
        }

        throw new Error(`Unhandled request: ${init?.method ?? "GET"} ${url}`);
      }) as unknown as typeof fetch
    );

    const runtime = getThriveExecutionRuntime({ thriveIntelligenceAvailable: true });
    const result = await executeBuildSpecToWordPress(
      connection,
      translated.spec,
      {
        enabled: true,
        appliedMappings: translated.appliedMappings,
        fallbackUsed: translated.fallbackUsed,
        executionMode: "wp_safe_mode",
        intelligenceAvailable: true,
        symbolInventoryPresent: true,
        intelligence,
        runtime,
        currentMode: "thrive_intel_mode",
        nativeGuard: null,
        nativeComposition: null,
        nativeExecution: null,
        nativeValidation: null,
        sectionResolutions: translated.sectionResolutions,
      },
      "use_existing"
    );

    expect(result.success).toBe(true);
    expect(result.thrive.executionMode).toBe("wp_safe_mode");
    expect(result.thrive.runtime.wpSafeMode).toBe(true);
    expect(result.thrive.sectionResolutions.some((entry) => entry.resolution === "existing_symbol")).toBe(true);
    expect(calls.some((entry) => entry.includes("/ttb/"))).toBe(false);
    expect(calls.some((entry) => entry.includes("/tcb/"))).toBe(false);
  });
});
