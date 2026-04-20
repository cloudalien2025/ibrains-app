import { afterEach, describe, expect, it, vi } from "vitest";
import { applyThriveMappings } from "@/lib/siteforge/thrive";
import { createThriveNativeCompositionPlan } from "@/lib/siteforge/thriveNativeComposer";
import { evaluateThriveNativeGuard, executeThriveNativePlan, rollbackThriveNativeExecution } from "@/lib/siteforge/thriveNativeHarness";
import { BuildSpec, ExecutionResult, ThriveIntelligence } from "@/lib/siteforge/contracts";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

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
      metadata: { template: "landing", shellLayoutCandidate: "thrive-homepage-canonical", shellTemplateGroupCandidate: "homepage" },
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
  primitiveCounts: { thriveTemplate: 2, thriveLayout: 1, thriveSection: 1, tcbSymbol: 1 },
  safeHints: { frontPageUsesWpSettings: true },
  warnings: [],
};

const execution: ExecutionResult = {
  success: true,
  createdPages: [{ title: "Home", slug: "home", pageId: 65, url: "https://staging.example.com/home", status: "updated", intent: "homepage", decision: "reused_existing" }],
  homepage: { success: true, pageId: 65, title: "Home", message: "ok" },
  menu: { success: true, menuId: 20, message: "ok" },
  thrive: {
    enabled: true,
    appliedMappings: [],
    fallbackUsed: false,
    executionMode: "wp_safe_mode",
    intelligenceAvailable: true,
    symbolInventoryPresent: true,
    intelligence,
    runtime: { wpSafeMode: true, thriveIntelMode: true, stagingNativeMode: true },
    currentMode: "thrive_intel_mode",
    nativeGuard: null,
    nativeComposition: null,
    nativeExecution: null,
    sectionResolutions: [],
  },
  actionLog: [],
  warnings: [],
  errors: [],
};

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING;
  delete process.env.SITEFORGE_THRIVE_STAGING_MARKER;
  delete process.env.SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION;
  delete process.env.SITEFORGE_THRIVE_ROUTE_ALLOWLIST;
  delete process.env.SITEFORGE_THRIVE_NATIVE_OPERATION_ALLOWLIST;
});

describe("siteforge thrive native staging integration", () => {
  it("plans reuse/create mix, executes with verification, and supports cleanup", async () => {
    process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING = "1";
    process.env.SITEFORGE_THRIVE_STAGING_MARKER = "staging";
    process.env.SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION = "v1";
    process.env.SITEFORGE_THRIVE_ROUTE_ALLOWLIST = "/wp-json/wp/v2/thrive_template,/wp-json/wp/v2/thrive_section,/wp-json/wp/v2/pages";
    process.env.SITEFORGE_THRIVE_NATIVE_OPERATION_ALLOWLIST = "createOrUpdateTemplateShellReference,attachReusablePrimitiveToPagePlan,createOrUpdateSection,assignTemplateToPost";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

        if (init?.method === "POST" && url.includes("/wp-json/wp/v2/thrive_template")) return json({ id: 200, slug: "acme-shell" });
        if (init?.method === "GET" && url.includes("/wp-json/wp/v2/thrive_template/200")) return json({ id: 200, slug: "acme-shell" });
        if (init?.method === "POST" && url.includes("/wp-json/wp/v2/thrive_section")) return json({ id: 201, slug: "acme-cta" });
        if (init?.method === "GET" && url.includes("/wp-json/wp/v2/thrive_section/201")) return json({ id: 201, slug: "acme-cta" });
        if (init?.method === "POST" && url.includes("/wp-json/wp/v2/pages/65")) return json({ id: 65 });
        if (init?.method === "DELETE" && (url.includes("/wp-json/wp/v2/thrive_template/200") || url.includes("/wp-json/wp/v2/thrive_section/201"))) {
          return json({ deleted: true });
        }

        throw new Error(`Unhandled request: ${init?.method ?? "GET"} ${url}`);
      }) as unknown as typeof fetch
    );

    const mapped = applyThriveMappings(spec, true, intelligence);
    const guard = evaluateThriveNativeGuard({
      id: "conn_1",
      label: "staging",
      baseUrl: "https://staging.example.com",
      username: "bot",
      appPassword: "pw",
    });

    const plan = createThriveNativeCompositionPlan({
      spec: mapped.spec,
      intelligence,
      sectionResolutions: mapped.sectionResolutions,
      execution,
      guard,
    });

    expect(plan.summary.reusedExisting).toBeGreaterThan(0);
    expect(plan.summary.createdNative).toBeGreaterThan(0);

    const nativeExecution = await executeThriveNativePlan({
      connection: {
        id: "conn_1",
        label: "staging",
        baseUrl: "https://staging.example.com",
        username: "bot",
        appPassword: "pw",
      },
      mode: plan.mode,
      operations: plan.operations.map((entry) => ({ operation: entry.operation, payload: entry.payload })),
    });

    expect(nativeExecution.success).toBe(true);
    expect(nativeExecution.steps.some((entry) => entry.verificationPassed)).toBe(true);

    const rollback = await rollbackThriveNativeExecution({
      connection: {
        id: "conn_1",
        label: "staging",
        baseUrl: "https://staging.example.com",
        username: "bot",
        appPassword: "pw",
      },
      execution: nativeExecution,
    });

    expect(rollback.available).toBe(true);
    expect(rollback.steps.every((entry) => entry.success)).toBe(true);
  });
});
