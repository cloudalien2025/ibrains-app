import { describe, expect, it } from "vitest";
import {
  createFixtureWalmartCatalogBackfillProvider,
  runWalmartCatalogBackfillPreview,
  type WalmartCatalogBackfillInput,
  type WalmartCatalogBackfillProvider,
} from "@/lib/ecomviper/walmart/walmart-live-catalog-backfill";

function baseInput(overrides?: Partial<WalmartCatalogBackfillInput>): WalmartCatalogBackfillInput {
  return {
    sku: "ROC303",
    title: "OPA Enzymes Prebiotic Probiotics For Men And Women - 60 Ct",
    brand: "OPA Nutrition",
    manufacturer: "",
    category: "Supplements",
    packCount: "60 ct",
    sizeHint: "60 ct",
    itemId: "2791205430",
    upc: "123456789012",
    gtin: "0123456789012",
    canonicalPublicUrl: "https://www.walmart.com/ip/2791205430",
    currentFields: {
      productName: "OPA Enzymes Prebiotic Probiotics For Men And Women - 60 Ct",
      siteDescription: "",
      longDescription: "",
      keyFeatures: [],
      brand: "",
      manufacturer: "",
      price: null,
      primaryImageUrl: "",
      galleryImageUrls: [],
      category: "Supplements",
      publicWalmartUrl: "",
      publicWalmartItemId: "",
      upc: "123456789012",
      gtin: "0123456789012",
    },
    currentFieldSources: {
      productName: "seller_native",
      siteDescription: "fallback",
      longDescription: "fallback",
      keyFeatures: "fallback",
      brand: "fallback",
      manufacturer: "fallback",
      price: "fallback",
      primaryImageUrl: "fallback",
      galleryImageUrls: "fallback",
      category: "seller_native",
      publicWalmartUrl: "fallback",
      publicWalmartItemId: "fallback",
      upc: "seller_native",
      gtin: "seller_native",
    },
    userDraftFields: {},
    ...overrides,
  };
}

function fixtureProviderWithCandidate(candidate: Record<string, unknown>) {
  return createFixtureWalmartCatalogBackfillProvider({
    candidates: [
      {
        source: "walmart_item_api",
        payload: candidate,
      },
    ],
  });
}

describe("Walmart live catalog backfill preview", () => {
  it("returns skipped_no_identifier when no usable identifier/title exists", async () => {
    const result = await runWalmartCatalogBackfillPreview({
      backfillInput: baseInput({
        title: "",
        itemId: "",
        upc: "",
        gtin: "",
        canonicalPublicUrl: "",
      }),
      provider: createFixtureWalmartCatalogBackfillProvider({ candidates: [] }),
    });

    expect(result.status).toBe("skipped_no_identifier");
    expect(result.matchConfidence).toBe("none");
  });

  it("returns skipped_no_credentials when provider says credentials are missing", async () => {
    const provider: WalmartCatalogBackfillProvider = {
      providerName: "no_credentials",
      async fetchCandidates() {
        return {
          status: "no_credentials",
          credentialMode: "unavailable",
          candidates: [],
          diagnostics: [
            {
              code: "missing_credentials",
              message: "Credentials missing",
              source: "walmart_item_api",
            },
          ],
          warnings: [],
        };
      },
    };

    const result = await runWalmartCatalogBackfillPreview({
      backfillInput: baseInput(),
      provider,
    });
    expect(result.status).toBe("skipped_no_credentials");
  });

  it("returns provider_error when provider reports an error", async () => {
    const provider: WalmartCatalogBackfillProvider = {
      providerName: "provider_error",
      async fetchCandidates() {
        return {
          status: "error",
          credentialMode: "byo_live",
          candidates: [],
          diagnostics: [
            {
              code: "provider_error",
              message: "Provider failed",
              source: "walmart_item_api",
            },
          ],
          warnings: [],
        };
      },
    };

    const result = await runWalmartCatalogBackfillPreview({
      backfillInput: baseInput(),
      provider,
    });
    expect(result.status).toBe("provider_error");
  });

  it("matches exact candidate and fills missing/placeholder fields", async () => {
    const result = await runWalmartCatalogBackfillPreview({
      backfillInput: baseInput({
        currentFields: {
          ...baseInput().currentFields,
          siteDescription: "Not available",
          longDescription: "",
        },
      }),
      provider: fixtureProviderWithCandidate({
        itemId: "2791205430",
        productName: "OPA Enzymes Prebiotic Probiotics For Men And Women - 60 Ct",
        shortDescription: "OPA Gut Enzyme & Probiotic Digestive Balance support.",
        longDescription: "Digestive Enzymes and Probiotic Support formula.",
        keyFeatures: ["Digestive Enzymes", "Probiotic Support", "Clean Formula"],
        brand: "OPA Nutrition",
        manufacturer: "OPA Nutrition",
        price: 24.99,
        imageUrl: "https://images.example.com/opa-roc303-primary.jpg",
        itemPageUrl:
          "https://www.walmart.com/ip/OPA-Enzymes-Prebiotic-Probiotics-For-Men-And-Women-60-Ct/2791205430?athbdg=L1600",
      }),
    });

    expect(result.status).toBe("matched");
    expect(result.canonicalItemId).toBe("2791205430");
    expect(result.canonicalPublicUrl).toBe("https://www.walmart.com/ip/2791205430");
    expect(result.fieldPatches.some((row) => row.action === "filled_missing")).toBe(true);
    expect(result.fieldPatches.some((row) => row.action === "replaced_placeholder")).toBe(true);
  });

  it("keeps seller-native fields when seller-native values are present", async () => {
    const result = await runWalmartCatalogBackfillPreview({
      backfillInput: baseInput({
        currentFields: {
          ...baseInput().currentFields,
          brand: "OPA Nutrition",
        },
        currentFieldSources: {
          ...baseInput().currentFieldSources,
          brand: "seller_native",
        },
      }),
      provider: fixtureProviderWithCandidate({
        itemId: "2791205430",
        title: "OPA Enzymes Prebiotic Probiotics For Men And Women - 60 Ct",
        brand: "OPA Nutrition",
      }),
    });

    const brandRow = result.fieldPatches.find((row) => row.field === "brand");
    expect(brandRow?.action).toBe("kept_seller_native");
  });

  it("does not overwrite user-edited draft fields", async () => {
    const result = await runWalmartCatalogBackfillPreview({
      backfillInput: baseInput({
        userDraftFields: {
          siteDescription: "User edited site description",
        },
      }),
      provider: fixtureProviderWithCandidate({
        itemId: "2791205430",
        title: "OPA Enzymes Prebiotic Probiotics For Men And Women - 60 Ct",
        shortDescription: "Provider site description",
      }),
    });

    const row = result.fieldPatches.find((entry) => entry.field === "siteDescription");
    expect(row?.action).toBe("skipped_user_edited");
  });

  it("returns ambiguous when top candidates are too close without exact identifiers", async () => {
    const provider = createFixtureWalmartCatalogBackfillProvider({
      candidates: [
        {
          source: "walmart_item_search",
          payload: {
            itemId: "1111111111",
            title: "OPA Enzymes Prebiotic Probiotics For Men And Women Digestive Balance 60 Ct",
            brand: "OPA Nutrition",
            shortDescription: "Digestive support formula for daily use.",
            imageUrl: "https://images.example.com/candidate-1.jpg",
            keyFeatures: ["Digestive Enzymes", "Probiotic Support"],
          },
        },
        {
          source: "walmart_item_search",
          payload: {
            itemId: "2222222222",
            title: "OPA Enzymes Probiotic Prebiotic For Men And Women Digestive Balance 60 Ct",
            brand: "OPA Nutrition",
            shortDescription: "Digestive support formula for daily use.",
            imageUrl: "https://images.example.com/candidate-2.jpg",
            keyFeatures: ["Digestive Enzymes", "Probiotic Support"],
          },
        },
      ],
    });

    const result = await runWalmartCatalogBackfillPreview({
      backfillInput: baseInput({
        itemId: "",
        upc: "",
        gtin: "",
        canonicalPublicUrl: "",
      }),
      provider,
    });

    expect(result.status).toBe("ambiguous");
  });

  it("covers ROC303 regression by returning matched catalog patches for missing content", async () => {
    const result = await runWalmartCatalogBackfillPreview({
      backfillInput: baseInput({
        currentFields: {
          ...baseInput().currentFields,
          siteDescription: "",
          longDescription: "",
          keyFeatures: [],
          brand: "",
        },
      }),
      provider: fixtureProviderWithCandidate({
        itemId: "2791205430",
        productName: "OPA Enzymes Prebiotic Probiotics For Men And Women - 60 Ct",
        shortDescription:
          "OPA Gut Enzyme & Probiotic Digestive Balance support for women and men.",
        longDescription:
          "Digestive Enzymes, Probiotic Support, Plant-Based Enzymes, Gut Balance, Vegetable Capsules, Clean Formula.",
        keyFeatures: [
          "Digestive Enzymes",
          "Probiotic Support",
          "Plant-Based Enzymes",
          "Gut Balance",
          "Vegetable Capsules",
          "Clean Formula",
        ],
        brand: "OPA Nutrition",
      }),
    });

    expect(result.status).toBe("matched");
    expect(result.fieldPatches.some((row) => row.field === "siteDescription")).toBe(true);
    expect(result.fieldPatches.some((row) => row.field === "keyFeatures")).toBe(true);
  });
});
