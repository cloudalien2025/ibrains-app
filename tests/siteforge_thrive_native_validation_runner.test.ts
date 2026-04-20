import { afterEach, describe, expect, it, vi } from "vitest";
import { BuildSpec, ConnectionProfile, ExecutionResult, ThriveIntelligence, ThriveSectionResolution } from "@/lib/siteforge/contracts";
import { runThriveNativeValidation } from "@/lib/siteforge/thriveNativeValidation";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const connection: ConnectionProfile = {
  id: "conn_1",
  label: "staging",
  baseUrl: "https://staging.example.com",
  username: "bot",
  appPassword: "pw",
};

const spec: BuildSpec = {
  siteTitle: "Acme",
  homepageSlug: "home",
  menu: [{ label: "Home", slug: "home" }],
  pages: [
    {
      pageId: "p1",
      title: "Home",
      slug: "home",
      purpose: "homepage",
      sections: [
        { id: "hero", type: "hero", heading: "Hero", body: "Hero body", metadata: {} },
        { id: "cta", type: "cta", heading: "CTA", body: "CTA body", metadata: {} },
      ],
      metadata: {
        template: "landing",
        shellTemplateGroupCandidate: "homepage",
        shellLayoutCandidate: "thrive-homepage-canonical",
      },
    },
  ],
  metadata: { conversionFocus: "high", thriveAware: true, createdAt: "2026-04-20T00:00:00.000Z" },
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

const sectionResolutions: ThriveSectionResolution[] = [
  {
    pageSlug: "home",
    sectionId: "hero",
    sectionType: "hero",
    sectionIntent: "conversion",
    symbolCandidateType: "header",
    preferredRenderTarget: "thrive_symbol_reference",
    resolution: "existing_symbol",
    matchedSymbolId: 57,
    matchedSymbolTitle: "Default Header",
    matchedRole: "header",
    confidence: 0.95,
    reason: "match",
    rejectedReasons: [],
  },
  {
    pageSlug: "home",
    sectionId: "cta",
    sectionType: "cta",
    sectionIntent: "conversion",
    symbolCandidateType: "cta",
    preferredRenderTarget: "wp_html_fallback",
    resolution: "wp_html_fallback",
    matchedSymbolId: null,
    matchedSymbolTitle: null,
    matchedRole: null,
    confidence: 0.2,
    reason: "fallback",
    rejectedReasons: ["no_match"],
  },
];

const execution: ExecutionResult = {
  success: true,
  createdPages: [{ title: "Home", slug: "home", pageId: 65, url: "https://staging.example.com/home", status: "updated", intent: "homepage", decision: "reused_existing" }],
  homepage: { success: true, pageId: 65, title: "Home", message: "ok" },
  menu: { success: true, menuId: 10, message: "ok" },
  thrive: {
    enabled: true,
    appliedMappings: [],
    fallbackUsed: false,
    executionMode: "wp_safe_mode",
    intelligenceAvailable: true,
    symbolInventoryPresent: true,
    intelligence,
    runtime: { wpSafeMode: true, thriveIntelMode: true, stagingNativeMode: true },
    currentMode: "thrive_native_staging_mode",
    nativeGuard: null,
    nativeComposition: null,
    nativeExecution: null,
    nativeValidation: null,
    sectionResolutions,
  },
  actionLog: [],
  warnings: [],
  errors: [],
};

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING;
  delete process.env.SITEFORGE_ENABLE_THRIVE_NATIVE;
  delete process.env.SITEFORGE_APPROVED_NATIVE_TARGETS;
  delete process.env.SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION;
  delete process.env.SITEFORGE_THRIVE_ROUTE_ALLOWLIST;
  delete process.env.SITEFORGE_THRIVE_NATIVE_OPERATION_ALLOWLIST;
});

describe("siteforge thrive native validation runner", () => {
  it("runs dry-run without writes and records non-promotion summary", async () => {
    process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING = "1";
    process.env.SITEFORGE_APPROVED_NATIVE_TARGETS = "staging.example.com";
    process.env.SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION = "v1";
    process.env.SITEFORGE_THRIVE_ROUTE_ALLOWLIST = "/wp-json/wp/v2/thrive_template,/wp-json/wp/v2/thrive_section,/wp-json/wp/v2/pages";
    process.env.SITEFORGE_THRIVE_NATIVE_OPERATION_ALLOWLIST =
      "createOrUpdateTemplateShellReference,attachReusablePrimitiveToPagePlan,createOrUpdateSection,assignTemplateToPost";

    const writes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method ?? "GET";
        if (method !== "GET") writes.push(`${method}:${url}`);

        if (method === "GET" && url.includes("/wp-json/wp/v2/pages/65")) {
          return json({ id: 65, status: "publish", link: "https://staging.example.com/home" });
        }
        if (method === "GET" && url.includes("/wp-json/wp/v2/settings")) {
          return json({ show_on_front: "page", page_on_front: 65, siteurl: "https://staging.example.com" });
        }
        if (method === "GET" && url === "https://staging.example.com/") return new Response("<html>ok</html>", { status: 200 });
        throw new Error(`Unhandled request ${method} ${url}`);
      }) as unknown as typeof fetch
    );

    const result = await runThriveNativeValidation({
      connection,
      spec,
      intelligence,
      sectionResolutions,
      execution,
      mode: "dry_run",
    });

    expect(result.mode).toBe("dry_run");
    expect(result.status).toBe("passed");
    expect(writes).toHaveLength(0);
    expect(result.summary.reusedExisting).toBeGreaterThan(0);
    expect(result.promotionCandidateSummary.ready).toBe(false);
    expect(result.promotionCandidateSummary.reason).toBe("dry_run_only");
    expect(result.verification.renderability.status).toBe("render_ok");
    expect(result.verification.renderability.checkedUrl).toBe("https://staging.example.com/");
  });

  it("runs real mode with verification and rollback cleanup for created objects", async () => {
    process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING = "1";
    process.env.SITEFORGE_APPROVED_NATIVE_TARGETS = "staging.example.com";
    process.env.SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION = "v1";
    process.env.SITEFORGE_THRIVE_ROUTE_ALLOWLIST = "/wp-json/wp/v2/thrive_template,/wp-json/wp/v2/thrive_section,/wp-json/wp/v2/pages";
    process.env.SITEFORGE_THRIVE_NATIVE_OPERATION_ALLOWLIST =
      "createOrUpdateTemplateShellReference,attachReusablePrimitiveToPagePlan,createOrUpdateSection,assignTemplateToPost";

    const deleted = new Set<string>();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method ?? "GET";

        if (method === "POST" && url.includes("/wp-json/wp/v2/thrive_template")) return json({ id: 200, slug: "acme-shell" });
        if (method === "POST" && url.includes("/wp-json/wp/v2/thrive_section")) return json({ id: 201, slug: "acme-cta" });
        if (method === "POST" && url.includes("/wp-json/wp/v2/pages/65")) return json({ id: 65, status: "publish" });

        if (method === "GET" && url.includes("/wp-json/wp/v2/thrive_template/200")) {
          return deleted.has("thrive_template:200") ? json({ code: "not_found" }, 404) : json({ id: 200, slug: "acme-shell" }, 200);
        }
        if (method === "GET" && url.includes("/wp-json/wp/v2/thrive_section/201")) {
          return deleted.has("thrive_section:201") ? json({ code: "not_found" }, 404) : json({ id: 201, slug: "acme-cta" }, 200);
        }
        if (method === "GET" && url.includes("/wp-json/wp/v2/pages/65")) {
          return json({ id: 65, status: "publish", link: "https://staging.example.com/home" }, 200);
        }
        if (method === "GET" && url.includes("/wp-json/wp/v2/settings")) {
          return json({ show_on_front: "page", page_on_front: 65, siteurl: "https://staging.example.com" }, 200);
        }
        if (method === "GET" && url === "https://staging.example.com/") return new Response("<html>ok</html>", { status: 200 });

        if (method === "DELETE" && url.includes("/wp-json/wp/v2/thrive_template/200")) {
          deleted.add("thrive_template:200");
          return json({ deleted: true }, 200);
        }
        if (method === "DELETE" && url.includes("/wp-json/wp/v2/thrive_section/201")) {
          deleted.add("thrive_section:201");
          return json({ deleted: true }, 200);
        }

        throw new Error(`Unhandled request ${method} ${url}`);
      }) as unknown as typeof fetch
    );

    const result = await runThriveNativeValidation({
      connection,
      spec,
      intelligence,
      sectionResolutions,
      execution,
      mode: "real_run",
      rollbackStrategy: "after_run",
    });

    expect(result.mode).toBe("real_run");
    expect(result.execution?.success).toBe(true);
    expect(result.verification.failedSteps).toBe(0);
    expect(result.rollback?.steps.length).toBeGreaterThan(0);
    expect(result.rollbackVerification.attempted).toBe(true);
    expect(result.rollbackVerification.success).toBe(true);
    expect(result.promotionCandidateSummary.payloadHashes.length).toBeGreaterThan(0);
    expect(result.promotionCandidateSummary.createdObjectIds.some((entry) => entry.id === 200)).toBe(true);
    expect(result.verification.renderability.status).toBe("render_ok");
  });

  it("returns blocked result when guard eligibility fails", async () => {
    const result = await runThriveNativeValidation({
      connection,
      spec,
      intelligence,
      sectionResolutions,
      execution,
      mode: "real_run",
    });

    expect(result.status).toBe("blocked");
    expect(result.summary.blockedByGuard).toBeGreaterThan(0);
    expect(result.promotionCandidateSummary.ready).toBe(false);
  });

  it("classifies front-page mismatch when homepage settings point elsewhere", async () => {
    process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING = "1";
    process.env.SITEFORGE_APPROVED_NATIVE_TARGETS = "staging.example.com";
    process.env.SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION = "v1";
    process.env.SITEFORGE_THRIVE_ROUTE_ALLOWLIST = "/wp-json/wp/v2/thrive_template,/wp-json/wp/v2/thrive_section,/wp-json/wp/v2/pages";
    process.env.SITEFORGE_THRIVE_NATIVE_OPERATION_ALLOWLIST =
      "createOrUpdateTemplateShellReference,attachReusablePrimitiveToPagePlan,createOrUpdateSection,assignTemplateToPost";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method ?? "GET";
        if (method === "GET" && url.includes("/wp-json/wp/v2/pages/65")) {
          return json({ id: 65, status: "publish", link: "https://staging.example.com/home" });
        }
        if (method === "GET" && url.includes("/wp-json/wp/v2/settings")) {
          return json({ show_on_front: "page", page_on_front: 501, siteurl: "https://staging.example.com" });
        }
        if (method === "GET" && url === "https://staging.example.com/home") return new Response("<html>404 not found</html>", { status: 404 });
        throw new Error(`Unhandled request ${method} ${url}`);
      }) as unknown as typeof fetch
    );

    const result = await runThriveNativeValidation({
      connection,
      spec,
      intelligence,
      sectionResolutions,
      execution,
      mode: "dry_run",
    });

    expect(result.verification.renderability.status).toBe("front_page_mismatch");
    expect(result.verification.pageReachable).toBe(false);
    expect(result.verification.notes.some((entry) => entry.includes("front_page_mismatch_setting"))).toBe(true);
  });

  it("classifies wrong-target-url when fallback page link is unreachable", async () => {
    process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING = "1";
    process.env.SITEFORGE_APPROVED_NATIVE_TARGETS = "staging.example.com";
    process.env.SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION = "v1";
    process.env.SITEFORGE_THRIVE_ROUTE_ALLOWLIST = "/wp-json/wp/v2/thrive_template,/wp-json/wp/v2/thrive_section,/wp-json/wp/v2/pages";
    process.env.SITEFORGE_THRIVE_NATIVE_OPERATION_ALLOWLIST =
      "createOrUpdateTemplateShellReference,attachReusablePrimitiveToPagePlan,createOrUpdateSection,assignTemplateToPost";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method ?? "GET";
        if (method === "GET" && url.includes("/wp-json/wp/v2/pages/65")) {
          return json({ id: 65, status: "publish", link: "https://staging.example.com/home" });
        }
        if (method === "GET" && url.includes("/wp-json/wp/v2/settings")) return json({ code: "forbidden" }, 403);
        if (method === "GET" && url === "https://staging.example.com/home") return new Response("<html>404 not found</html>", { status: 404 });
        throw new Error(`Unhandled request ${method} ${url}`);
      }) as unknown as typeof fetch
    );

    const result = await runThriveNativeValidation({
      connection,
      spec,
      intelligence,
      sectionResolutions,
      execution,
      mode: "dry_run",
    });

    expect(result.verification.renderability.status).toBe("wrong_target_url");
    expect(result.verification.renderability.checkedUrl).toBe("https://staging.example.com/home");
    expect(result.verification.renderability.httpStatus).toBe(404);
  });
});
