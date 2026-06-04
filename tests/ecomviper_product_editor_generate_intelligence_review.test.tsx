// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EcomViperProductEditorClient from "@/app/ecomviper/products/[productId-or-handle]/product-editor-client";
import type { ShopifyProductEditorInitialState } from "@/lib/ecomviper/shopify/shopify-product-editor-state";

function buildState(): ShopifyProductEditorInitialState {
  return {
    productReference: "roc949",
    productFound: true,
    notFoundMessage: null,
    source: "live_shopify",
    sourceLabel: "Live Shopify",
    hydrationMode: "live",
    currentShopifyListing: {
      productId: "gid://shopify/Product/949",
      title: "Premium Magnesium Glycinate Gummies",
      handle: "premium-magnesium-glycinate-gummies",
      status: "active",
      vendor: "OPA Nutrition",
      productType: "Supplements",
      tags: [],
      collections: [],
      descriptionText: "",
      descriptionHtml: "",
      seoTitle: "",
      seoDescription: "",
      productUrl: "",
      canonicalUrl: "",
      primaryImageUrl: "https://example.com/front.png",
      images: [
        {
          id: "img-1",
          url: "https://example.com/front.png",
          altText: "front",
          source: "product",
        },
      ],
      variants: [{ id: "v", title: "Default", sku: "ROC949", barcode: "", price: 39.99, compareAtPrice: null, inventoryQuantity: 5 }],
      metafields: [],
      source: "live_shopify",
      sourceLabel: "Live Shopify",
      hydrationMode: "live",
      lastSyncedAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
    },
    optimizedShopifyProposal: null,
    editableShopifyDraft: null,
    openAiConnected: true,
    openAiStatusLabel: "Connected",
    lastSyncedAt: new Date().toISOString(),
    warnings: [],
    pdpIntelligence: null,
    supplierContext: {
      matched: true,
      matchedSku: "ROC949",
      matchConfidence: 0.95,
      matchReason: "sku_match",
      platform: "rocktomic",
      syncStatus: "synced",
      syncRequired: false,
      syncMessage: null,
      inventoryAvailable: true,
      lastSupplierCheckAt: new Date().toISOString(),
      product: null,
    },
    sourceFacts: {
      shopifyProductId: "gid://shopify/Product/949",
      shopifyProductHandle: "premium-magnesium-glycinate-gummies",
      shopifySku: "ROC949",
      normalizedSku: "ROC949",
      supplierProductRecordFound: true,
      pricingRecordFound: true,
      inventoryRecordFound: true,
      assetsRecordFound: true,
      selectedMembershipTier: null,
      effectiveMembershipTier: null,
      usingDefaultMembershipTier: false,
      detectedMembershipTiers: [],
      lastGlobalSupplierSyncAt: null,
      lastGeneratedIntelligenceAt: null,
      staleIntelligence: false,
      amountPerServing: { status: "source_missing", value: "", displayText: "" },
      activeIngredients: { status: "source_missing", values: [], displayText: "" },
      dietaryAllergenAttributes: { status: "source_missing", values: [], displayText: "" },
      keyProductFeatures: { status: "source_missing", values: [], displayText: "" },
      certifications: { status: "source_missing", values: [], displayText: "" },
      manufacturingClaims: { status: "source_missing", values: [], displayText: "" },
      servingSize: { status: "source_missing", value: "", displayText: "" },
      servingsPerContainer: { status: "source_missing", value: "", displayText: "" },
      supplementFacts: { status: "source_missing", value: "", displayText: "" },
      otherIngredients: { status: "source_missing", value: "", displayText: "" },
      testingClaims: { status: "source_missing", values: [], displayText: "" },
      commerce: {
        shopifyPrice: 39.99,
        compareAtPrice: null,
        wholesaleCost: null,
        msrp: null,
        marginPercent: null,
        estimatedProfit: null,
        pricingStatusLabel: "Not available yet",
        message: "Select membership tier to calculate",
        currency: "USD",
      },
      assets: {
        coaStatus: "missing",
        coaUrl: null,
        message: "Not available yet",
        labelTemplateUrl: "",
        mockupUrl: "",
        coaLinkStatus: "not_present",
      },
      inventory: {
        status: "unknown",
        displayText: "Not available yet",
      },
      diagnostics: [],
      missingFields: [],
    },
    supplierFactsPanel: null,
  };
}

describe("ecomviper product editor generate-intelligence review mode", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it("calls generate action, shows loading, and renders review-only proposal with plain notices", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          action: "generate",
          reviewOnly: true,
          intelligence: {
            product_intelligence_id: "x",
            shopify_product_id: "gid://shopify/Product/949",
            product_handle: "premium-magnesium-glycinate-gummies",
            supplier: null,
            supplier_sku: null,
            ai_product_summary: "",
            best_for: [],
            not_best_for: [],
            use_cases: [],
            key_features: [],
            highlights: [],
            quick_facts: [],
            ingredient_highlights: [],
            supplement_facts: "",
            ingredients: [],
            serving_size: "",
            servings_per_container: "",
            other_ingredients: "",
            source_diagnostics: [],
            trust_signals: [],
            certifications: [],
            dietary_attributes: [],
            manufacturing_claims: [],
            warnings_text: [],
            compliance_notes: [],
            coa_status: "unknown",
            coa_link: "",
            coa_expiration_date: "",
            coa_testing_categories: [],
            coa_verification_status: "unknown",
            price: null,
            compare_at_price: null,
            wholesale_cost: null,
            msrp: null,
            margin_percent: null,
            estimated_profit: null,
            currency: "USD",
            inventory_status: "unknown",
            availability_status: "Availability Unknown",
            ships_from: "Unknown",
            processing_time: "Unknown",
            shipping_time: "Unknown",
            return_policy: "Unknown",
            fulfillment_status: "unknown",
            compliance_safe_claims: [],
            comparison_content: "",
            faq: [],
            buyer_intent_mapping: [],
            entity_mapping: [],
            semantic_coverage: [],
            agentic_selection_notes: "",
            referral_readiness: [],
            faqs: [],
            product_images: [],
            supplement_facts_assets: [],
            coa_assets: [],
            label_assets: [],
            mockup_assets: [],
            seo_title: "",
            meta_description: "",
            product_schema: "",
            offer_schema: "",
            faq_schema: "",
            review_schema: "",
            agentic_schema_readiness: "unknown",
            generation_status: "generated",
            last_generated_at: new Date().toISOString(),
            last_edited_at: null,
            updated_at: new Date().toISOString(),
            compliance_review: {
              risk_level: "low",
              risky_phrases_found: [],
              safer_rewrite_notes: [],
              supplement_compliance_notes: [],
            },
          },
          copywriting: {
            status: "success",
            safeMessage: "Generated proposal is ready for review.",
            missingDataNotices: ["COA missing.", "Supplier match not found."],
            complianceWarnings: [],
            output: {
              optimizedTitle: "Premium Magnesium Glycinate Gummies - Optimized",
              listingSubtitle: "Daily support",
              shortDescription: "Short desc",
              fullDescription: "Full desc",
              benefitBullets: ["Bullet 1", "Bullet 2"],
              ingredientHighlights: [],
              usageSummary: "Use daily",
              faqSuggestions: [{ question: "How to use?", answer: "Use daily" }],
              imageAltTextSuggestions: [{ imageId: "img-1", altText: "Front bottle" }],
              metaTitle: "Meta title",
              metaDescription: "Meta description",
              agenticVisibilitySignals: {
                primaryIntents: ["intent"],
                comparisonHooks: ["hook"],
                trustSignals: ["trust"],
                faqCoverage: ["faq"],
              },
              complianceWarnings: [],
              missingDataNotices: ["COA missing.", "Supplier match not found."],
              sourceFactsUsed: [],
              claimsRejected: [],
              qualityScores: {
                schemaValidity: 100,
                factualGrounding: 100,
                supplementCompliance: 100,
                agenticVisibility: 100,
                conversionQuality: 100,
                missingDataBehavior: 100,
                brandVoice: 100,
                sourceUseTransparency: 100,
              },
              channelVariants: {
                shopify: "shopify",
                optibay: null,
                optiwal: null,
                optizon: null,
                genericMarketplace: null,
              },
              generationMetadata: {
                contractVersion: "phase_6_1",
                generatedAt: "2026-06-01T00:00:00.000Z",
                sourceMode: "manual",
                model: null,
              },
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await act(async () => {
      root.render(<EcomViperProductEditorClient initialState={buildState()} />);
    });

    const generateButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Generate Intelligence"
    );
    expect(generateButton).toBeDefined();

    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchSpy).toHaveBeenCalled();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/ecomviper/pdp-intelligence");
    expect(String(init.body)).toContain('"action":"generate"');

    const reviewPanel = container.querySelector('[data-testid="ecomviper-copywriting-review-panel"]');
    expect(reviewPanel?.textContent).toContain("Generated Proposal (Review Only)");
    expect(reviewPanel?.textContent).toContain("Optimized Title");
    expect(reviewPanel?.textContent).toContain("COA missing.");
    expect(reviewPanel?.textContent).toContain("Supplier match not found.");
    expect(container.textContent).not.toContain("ingredientMatchingReadiness");
    expect(container.textContent).not.toContain("productEditorFactsReadiness");
    expect(container.textContent).not.toContain("\"optimizedTitle\"");

    const actions = Array.from(container.querySelectorAll('[data-testid="ecomviper-product-editor-actions"] button')).map(
      (button) => button.textContent?.trim()
    );
    expect(actions).toEqual(["Generate Intelligence", "Save Changes", "Publish"]);
  });

  it("shows latest failure while preserving prior proposal as previous output", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            action: "generate",
            copywriting: {
              status: "success",
              safeMessage: "Generated proposal is ready for review.",
              missingDataNotices: [],
              complianceWarnings: [],
              output: {
                optimizedTitle: "Proposal V1",
                listingSubtitle: "Daily support",
                shortDescription: "Short desc",
                fullDescription: "Full desc",
                benefitBullets: ["Bullet 1"],
                ingredientHighlights: [],
                usageSummary: "Use daily",
                faqSuggestions: [{ question: "How to use?", answer: "Use daily" }],
                imageAltTextSuggestions: [{ imageId: "img-1", altText: "Front bottle" }],
                metaTitle: "Meta title",
                metaDescription: "Meta description",
                agenticVisibilitySignals: {
                  primaryIntents: ["intent"],
                  comparisonHooks: ["hook"],
                  trustSignals: ["trust"],
                  faqCoverage: ["faq"],
                },
                complianceWarnings: [],
                missingDataNotices: [],
                sourceFactsUsed: [],
                claimsRejected: [],
                qualityScores: {
                  schemaValidity: 100,
                  factualGrounding: 100,
                  supplementCompliance: 100,
                  agenticVisibility: 100,
                  conversionQuality: 100,
                  missingDataBehavior: 100,
                  brandVoice: 100,
                  sourceUseTransparency: 100,
                },
                channelVariants: {
                  shopify: "shopify",
                  optibay: null,
                  optiwal: null,
                  optizon: null,
                  genericMarketplace: null,
                },
                generationMetadata: {
                  contractVersion: "phase_6_1",
                  generatedAt: "2026-06-01T00:00:00.000Z",
                  sourceMode: "manual",
                  model: null,
                },
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            action: "generate",
            copywriting: {
              status: "model_error",
              safeMessage: "AI generation is unavailable right now.",
              missingDataNotices: [],
              complianceWarnings: [],
              output: null,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

    await act(async () => {
      root.render(<EcomViperProductEditorClient initialState={buildState()} />);
    });

    const generateButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Generate Intelligence"
    );
    expect(generateButton).toBeDefined();

    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Generated Proposal (Review Only)");
    expect(container.textContent).toContain("Proposal V1");

    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="ecomviper-generate-latest-error"]')?.textContent).toContain(
      "AI generation is unavailable right now."
    );
    const reviewPanel = container.querySelector('[data-testid="ecomviper-copywriting-review-panel"]');
    expect(reviewPanel?.textContent).toContain("Previous Generated Proposal (Review Only)");
    expect(reviewPanel?.textContent).toContain("Latest generation attempt failed. Showing previous proposal.");
    expect(reviewPanel?.textContent).toContain("Proposal V1");
    expect(container.textContent).not.toContain("PDP intelligence generate failed.");
  });
});
