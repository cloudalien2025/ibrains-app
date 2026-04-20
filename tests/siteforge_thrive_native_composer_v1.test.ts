import { describe, expect, it } from "vitest";
import { createThriveNativeCompositionPlan } from "@/lib/siteforge/thriveNativeComposer";
import { BuildSpec, ExecutionResult, ThriveIntelligence, ThriveSectionResolution, ThriveNativeGuardStatus } from "@/lib/siteforge/contracts";

function buildSpec(): BuildSpec {
  return {
    siteTitle: "Acme",
    homepageSlug: "home",
    menu: [{ label: "Home", slug: "home" }],
    pages: [
      {
        pageId: "p_home",
        title: "Home",
        slug: "home",
        purpose: "homepage",
        sections: [
          { id: "hero", type: "hero", heading: "Hero", body: "Hero body", metadata: {} },
          { id: "cta", type: "cta", heading: "CTA", body: "CTA body", metadata: {} },
          { id: "faq", type: "faq", heading: "FAQ", body: "FAQ body", metadata: {} },
        ],
        metadata: { template: "landing", shellLayoutCandidate: "thrive-homepage-canonical", shellTemplateGroupCandidate: "homepage" },
      },
    ],
    metadata: { conversionFocus: "high", thriveAware: true, createdAt: "2026-04-20T00:00:00.000Z" },
  };
}

const execution: ExecutionResult = {
  success: true,
  createdPages: [
    { title: "Home", slug: "home", pageId: 65, url: "https://example.com/home", status: "updated", intent: "homepage", decision: "reused_existing" },
  ],
  homepage: { success: true, pageId: 65, message: "ok" },
  menu: { success: true, menuId: 1, message: "ok" },
  thrive: {
    enabled: true,
    appliedMappings: [],
    fallbackUsed: false,
    executionMode: "wp_safe_mode",
    intelligenceAvailable: true,
    symbolInventoryPresent: true,
    intelligence: null,
    runtime: { wpSafeMode: true, thriveIntelMode: true, stagingNativeMode: true },
    currentMode: "thrive_native_staging_mode",
    nativeGuard: null,
    nativeComposition: null,
    nativeExecution: null,
    sectionResolutions: [],
  },
  actionLog: [],
  warnings: [],
  errors: [],
};

const intelligence: ThriveIntelligence = {
  source: "wordpress_rest_get",
  collectedAt: "2026-04-20T00:00:00.000Z",
  mode: "wp_safe_mode",
  activeSkin: { id: 8, name: "Shapeshift", slug: "shapeshift", tag: "q1" },
  symbolInventory: [],
  symbolSummary: { total: 0, headers: 0, footers: 0, sections: 0, unknown: 0 },
  primitiveCounts: { thriveTemplate: 1, thriveLayout: 1, thriveSection: 1, tcbSymbol: 0 },
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
    matchedSymbolTitle: "Header",
    matchedRole: "header",
    confidence: 0.95,
    reason: "matched",
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
    confidence: 0,
    reason: "fallback",
    rejectedReasons: [],
  },
];

const eligibleGuard: ThriveNativeGuardStatus = {
  eligible: true,
  blockedReason: null,
  environment: "test",
  stagingMarkerValid: true,
  connectionHost: "staging.example.com",
  allowlistedOperations: [
    "createOrUpdateTemplateShellReference",
    "attachReusablePrimitiveToPagePlan",
    "createOrUpdateSection",
    "assignTemplateToPost",
  ],
  routeAllowlist: ["/wp-json/wp/v2/thrive_template"],
  schemaContractVersion: "v1",
};

describe("siteforge thrive native composer v1", () => {
  it("prefers reusable symbols and creates minimal native objects for unresolved sections", () => {
    const plan = createThriveNativeCompositionPlan({
      spec: buildSpec(),
      intelligence,
      sectionResolutions,
      execution,
      guard: eligibleGuard,
    });

    expect(plan.mode).toBe("thrive_native_staging_mode");
    expect(plan.homepagePostId).toBe(65);
    expect(plan.summary.reusedExisting).toBeGreaterThanOrEqual(1);
    expect(plan.sections.some((entry) => entry.intent === "reused_existing")).toBe(true);
    expect(plan.sections.some((entry) => entry.intent === "created_native")).toBe(true);
    expect(plan.operations.some((entry) => entry.operation === "createOrUpdateTemplateShellReference")).toBe(true);
  });

  it("blocks with explicit guard state when staging eligibility fails", () => {
    const blocked = createThriveNativeCompositionPlan({
      spec: buildSpec(),
      intelligence,
      sectionResolutions,
      execution,
      guard: { ...eligibleGuard, eligible: false, blockedReason: "production_environment_block" },
    });

    expect(blocked.mode).toBe("blocked_native_mode");
    expect(blocked.summary.blockedByGuard).toBeGreaterThan(0);
    expect(blocked.operations).toEqual([]);
  });
});
