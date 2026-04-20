import { describe, expect, it, vi } from "vitest";
import { BuildSession, SiteForgeSnapshot } from "@/lib/siteforge/contracts";
import { persistSnapshotFromSession } from "@/lib/siteforge/workspace";

function buildSession(execution: BuildSession["executionResult"]): BuildSession {
  const now = "2026-04-19T00:00:00.000Z";
  return {
    id: "sess_1",
    projectId: "proj_1",
    userId: "user_1",
    connectionId: "conn_1",
    type: "generate",
    triggerSource: "user",
    prompt: "build",
    websiteBrief: null,
    generationSource: "deterministic_fallback",
    aiModel: "gpt-5",
    connectionProfile: null,
    status: "completed",
    runState: {
      currentStage: "completed",
      progressPct: 100,
      timeline: [],
    },
    sitePlan: null,
    contentPackage: null,
    buildSpec: {
      siteTitle: "Acme",
      homepageSlug: "home",
      menu: [
        { label: "Home", slug: "home" },
        { label: "Contact", slug: "contact" },
      ],
      pages: [
        {
          pageId: "p_home",
          title: "Home",
          slug: "home",
          purpose: "home",
          sections: [],
          metadata: { template: "landing" },
        },
        {
          pageId: "p_contact",
          title: "Contact",
          slug: "contact",
          purpose: "contact",
          sections: [],
          metadata: { template: "contact" },
        },
      ],
      metadata: {
        conversionFocus: "high",
        thriveAware: true,
        createdAt: now,
      },
    },
    qaResult: null,
    executionResult: execution,
    revisionHistory: [],
    errorSummary: null,
    startedAt: now,
    completedAt: now,
    finishedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

describe("siteforge snapshot persistence reconciliation", () => {
  it("persists canonical homepage + known existing inventory + reuse/create decisions", async () => {
    const session = buildSession({
      success: true,
      createdPages: [
        {
          title: "Home",
          slug: "home",
          pageId: 10,
          url: "https://example.com/welcome",
          status: "updated",
          intent: "homepage",
          decision: "reused_existing",
          decisionReason: "homepage_strategy_use_existing:front_page_setting",
          matchedPage: { id: 10, slug: "welcome", title: "Welcome", status: "publish" },
        },
        {
          title: "Contact",
          slug: "contact",
          pageId: 11,
          url: "https://example.com/contact",
          status: "updated",
          intent: "contact",
          decision: "reused_existing",
          decisionReason: "contact_intent_match(score=195)",
          matchedPage: { id: 11, slug: "contact", title: "Contact", status: "publish" },
        },
        {
          title: "FAQ",
          slug: "faq",
          pageId: 30,
          url: "https://example.com/faq",
          status: "created",
          intent: "faq",
          decision: "created_new",
          decisionReason: "faq_intent_no_match",
          matchedPage: null,
        },
      ],
      homepage: {
        success: true,
        pageId: 10,
        title: "Home",
        message: "Existing front page retained",
        reason: "use_existing_front_page_retained",
      },
      menu: { success: true, menuId: 77, message: "ok" },
      thrive: {
        enabled: true,
        appliedMappings: [],
        fallbackUsed: false,
        executionMode: "wp_safe_mode",
        intelligenceAvailable: true,
        symbolInventoryPresent: true,
        runtime: {
          wpSafeMode: true,
          thriveIntelMode: true,
          stagingNativeMode: false,
        },
        currentMode: "thrive_intel_mode",
        nativeGuard: null,
        nativeComposition: null,
        nativeExecution: null,
        nativeValidation: null,
        sectionResolutions: [
          {
            pageSlug: "home",
            sectionId: "s_hero",
            sectionType: "hero",
            sectionIntent: "conversion",
            symbolCandidateType: "header",
            preferredRenderTarget: "thrive_symbol_reference",
            resolution: "existing_symbol",
            visualPattern: "hero_split",
            selectedVisualPrimitive: "thrive_template_symbol",
            primitiveSelectionSource: "existing_reusable_symbol",
            designIntentSatisfied: true,
            fallbackReason: null,
            matchedSymbolId: 57,
            matchedSymbolTitle: "Default Header for Shapeshift Theme",
            matchedRole: "header",
            confidence: 0.9,
            reason: "role_match:header|keyword_hits:2|builder_payload_present",
            rejectedReasons: [],
          },
        ],
        intelligence: {
          source: "wordpress_rest_get",
          collectedAt: "2026-04-19T00:00:00.000Z",
          mode: "wp_safe_mode",
          activeSkin: { id: 8, name: "Shapeshift Theme", slug: "shapeshift-theme", tag: "q1qj01" },
          symbolInventory: [
            {
              id: 57,
              title: "Default Header for Shapeshift Theme",
              slug: "default-header-for-shapeshift-theme",
              taxonomy: { slug: "headers", name: "Headers" },
              inferredRole: "header",
              reusable: true,
              hasBuilderContent: true,
              hasCustomCss: true,
            },
          ],
          symbolSummary: { total: 1, headers: 1, footers: 0, sections: 0, unknown: 0 },
          primitiveCounts: { thriveTemplate: 19, thriveLayout: 5, thriveSection: 1, tcbSymbol: 9 },
          safeHints: { frontPageUsesWpSettings: true },
          warnings: [],
        },
      },
      actionLog: [],
      warnings: [],
      errors: [],
      discovery: {
        source: "wordpress",
        frontPageId: 10,
        frontPageTitle: "Welcome",
        pages: [
          { id: 10, slug: "welcome", title: "Welcome", status: "publish", url: "https://example.com/welcome" },
          { id: 11, slug: "contact", title: "Contact", status: "publish", url: "https://example.com/contact" },
          { id: 40, slug: "about", title: "About", status: "publish", url: "https://example.com/about" },
        ],
      },
      reconciliation: {
        homepageStrategy: "use_existing",
        decisions: [],
      },
    });

    const upsertSnapshot = vi.fn(async (snapshot: SiteForgeSnapshot) => snapshot);
    const repo = { upsertSnapshot } as unknown as { upsertSnapshot: (snapshot: SiteForgeSnapshot) => Promise<SiteForgeSnapshot> };

    const snapshot = await persistSnapshotFromSession({
      repo: repo as never,
      session,
      homepageStrategy: "use_existing",
      connectionId: "conn_1",
      thriveDetected: true,
    });

    expect(snapshot.currentHomepageId).toBe(10);
    expect(snapshot.currentHomepageTitle).toBe("Home");
    expect(snapshot.currentHomepageSource).toBe("wordpress");
    expect(snapshot.thriveIntelligence?.activeSkin?.name).toBe("Shapeshift Theme");
    expect(snapshot.thriveIntelligence?.symbolSummary.headers).toBe(1);
    expect(snapshot.thriveModeSummary.thriveIntelMode).toBe(true);
    expect(snapshot.thriveSectionResolutions[0]?.matchedSymbolId).toBe(57);
    expect(snapshot.thriveNativeGuard).toBeNull();
    expect(snapshot.thriveNativeComposition).toBeNull();
    expect(snapshot.thriveNativeExecution).toBeNull();

    expect(snapshot.knownPages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 10, slug: "home", source: "reused", intent: "homepage", decision: "reused_existing" }),
        expect.objectContaining({ id: 11, slug: "contact", source: "reused", intent: "contact", decision: "reused_existing" }),
        expect.objectContaining({ id: 30, slug: "faq", source: "created", intent: "faq", decision: "created_new" }),
        expect.objectContaining({ id: 40, slug: "about", source: "existing" }),
      ])
    );
    expect(snapshot.pagesAffected).toBe(4);
    expect(snapshot.lastRunSummary).toBe("Pages applied: 3");
    expect(upsertSnapshot).toHaveBeenCalledTimes(1);
  });

  it("falls back to thrive source only when homepage is not a reused wordpress page", async () => {
    const session = buildSession({
      success: true,
      createdPages: [
        {
          title: "Home",
          slug: "home",
          pageId: 101,
          url: "https://example.com/home",
          status: "created",
          intent: "homepage",
          decision: "created_new",
          decisionReason: "homepage_strategy_create_new:create_new_homepage",
          matchedPage: null,
        },
      ],
      homepage: {
        success: true,
        pageId: 101,
        title: "Home",
        message: "Homepage assigned successfully.",
        reason: "settings_updated",
      },
      menu: { success: true, menuId: null, message: "ok" },
      thrive: {
        enabled: true,
        appliedMappings: [],
        fallbackUsed: false,
        executionMode: "wp_safe_mode",
        intelligenceAvailable: false,
        symbolInventoryPresent: false,
        runtime: {
          wpSafeMode: true,
          thriveIntelMode: false,
          stagingNativeMode: false,
        },
        currentMode: "wp_safe_mode",
        nativeGuard: null,
        nativeComposition: null,
        nativeExecution: null,
        nativeValidation: null,
        sectionResolutions: [],
        intelligence: null,
      },
      actionLog: [],
      warnings: [],
      errors: [],
      discovery: {
        source: "wordpress",
        frontPageId: null,
        frontPageTitle: null,
        pages: [],
      },
      reconciliation: {
        homepageStrategy: "create_new",
        decisions: [],
      },
    });

    const repo = {
      upsertSnapshot: vi.fn(async (snapshot: SiteForgeSnapshot) => snapshot),
    };

    const snapshot = await persistSnapshotFromSession({
      repo: repo as never,
      session,
      homepageStrategy: "create_new",
      connectionId: "conn_1",
      thriveDetected: true,
    });

    expect(snapshot.currentHomepageSource).toBe("thrive");
    expect(snapshot.currentHomepageId).toBe(101);
  });
});
