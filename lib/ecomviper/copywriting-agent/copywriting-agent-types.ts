export type ProductChannel = "shopify" | "optibay" | "optiwal" | "optizon" | "generic_marketplace" | "unknown";

export interface ProductCopywritingInput {
  productIdentity: {
    productId: string;
    handle: string | null;
    title: string;
    brand: string | null;
    productType: string | null;
    category: string | null;
    tags: string[];
    vendor: string | null;
    channel: ProductChannel;
  };
  currentListing: {
    title: string;
    descriptionText: string;
    descriptionHtml: string;
    bullets: string[];
    metaTitle: string;
    metaDescription: string;
    existingFaqs: Array<{ question: string; answer: string }>;
  };
  variants: Array<{
    sku: string | null;
    barcode: string | null;
    upc: string | null;
    gtin: string | null;
    price: number | null;
    compareAtPrice: number | null;
    inventory: number | null;
  }>;
  images: {
    selectedPrimaryImageUrl: string | null;
    items: Array<{
      id: string;
      url: string;
      altText: string | null;
      filename: string | null;
      role: string | null;
      order: number | null;
    }>;
  };
  supplierContext: {
    supplierSlug: string | null;
    supplierName: string | null;
    supplierSku: string | null;
    supplierProductName: string | null;
    matchStatus: "matched" | "candidate" | "no_match" | "unavailable";
    matchConfidence: string | null;
    matchReasons: string[];
    ingredientMatchingReadiness: string | null;
    productEditorFactsReadiness: string | null;
    complianceEvidenceReadiness: string | null;
    pricingReadiness: string | null;
    inventoryReadiness: string | null;
    optiPixelAssetReadiness: string | null;
  };
  supplementFacts: {
    servingSize: string | null;
    servingsPerContainer: string | null;
    activeIngredients: string[];
    ingredientAmounts: string[];
    otherIngredients: string[];
    suggestedUse: string | null;
    warnings: string | null;
  };
  sourceEvidence: {
    coaPresent: boolean;
    coaUrl: string | null;
    labelEvidencePresent: boolean;
    supplementFactsImagePresent: boolean;
    aiLabelTextEvidencePresent: boolean;
    aiLabelTextEvidenceStatus: string | null;
    aiLabelTextNeedsReview: boolean;
    structuredSupplementFactsPresent: boolean;
    supplementFactsSource: "db" | "artifact" | "ai_label_text" | "image_only" | "none" | "unknown";
    sourceFactsUsed: string[];
  };
  missingData: {
    coaMissing: boolean;
    pricingMissing: boolean;
    inventoryMissing: boolean;
    supplementFactsMissing: boolean;
    supplierMatchMissing: boolean;
    ingredientFactsMissing: boolean;
    structuredSupplementFactsMissing: boolean;
    servingSizeMissing: boolean;
    servingsPerContainerMissing: boolean;
    ingredientAmountsMissing: boolean;
    supplementFactsImageOnly: boolean;
    supplementFactsTextNeedsReview: boolean;
  };
  brandVoice: {
    tone: string;
    forbiddenTerms: string[];
    preferredTerms: string[];
    styleGuide: string[];
  };
  complianceProfile: {
    productClass: "supplement" | "non_supplement" | "unknown";
    supplementRules: string[];
    forbiddenClaimPatterns: string[];
    safeStructureFunctionLanguage: string[];
  };
  agenticVisibilityProfile: {
    targetSearchUseCases: string[];
    comparisonAttributes: string[];
    answerEngineSignals: string[];
    faqCoverageTargets: string[];
    trustSignals: string[];
  };
  outputTargets: {
    shopify: boolean;
    optibay: boolean;
    optiwal: boolean;
    optizon: boolean;
    genericMarketplace: boolean;
  };
}

export interface ProductCopywritingOutput {
  optimizedTitle: string;
  listingSubtitle: string;
  shortDescription: string;
  fullDescription: string;
  benefitBullets: string[];
  ingredientHighlights: string[];
  usageSummary: string;
  faqSuggestions: Array<{ question: string; answer: string }>;
  imageAltTextSuggestions: Array<{ imageId: string; altText: string }>;
  metaTitle: string;
  metaDescription: string;
  agenticVisibilitySignals: {
    primaryIntents: string[];
    comparisonHooks: string[];
    trustSignals: string[];
    faqCoverage: string[];
  };
  complianceWarnings: string[];
  missingDataNotices: string[];
  sourceFactsUsed: string[];
  claimsRejected: string[];
  qualityScores: {
    schemaValidity: number;
    factualGrounding: number;
    supplementCompliance: number;
    agenticVisibility: number;
    conversionQuality: number;
    missingDataBehavior: number;
    brandVoice: number;
    sourceUseTransparency: number;
  };
  channelVariants: {
    shopify: string | null;
    optibay: string | null;
    optiwal: string | null;
    optizon: string | null;
    genericMarketplace: string | null;
  };
  generationMetadata: {
    contractVersion: string;
    generatedAt: string;
    sourceMode: "fixture" | "manual" | "all_product" | "unknown";
    model: string | null;
  };
}

export interface ProductCopywritingOutputValidationResult {
  ok: boolean;
  errors: string[];
  value: ProductCopywritingOutput | null;
}

export const PRODUCT_COPYWRITING_OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "optimizedTitle",
    "listingSubtitle",
    "shortDescription",
    "fullDescription",
    "benefitBullets",
    "ingredientHighlights",
    "usageSummary",
    "faqSuggestions",
    "imageAltTextSuggestions",
    "metaTitle",
    "metaDescription",
    "agenticVisibilitySignals",
    "complianceWarnings",
    "missingDataNotices",
    "sourceFactsUsed",
    "claimsRejected",
    "qualityScores",
    "channelVariants",
    "generationMetadata",
  ],
  properties: {
    optimizedTitle: { type: "string" },
    listingSubtitle: { type: "string" },
    shortDescription: { type: "string" },
    fullDescription: { type: "string" },
    benefitBullets: { type: "array", items: { type: "string" } },
    ingredientHighlights: { type: "array", items: { type: "string" } },
    usageSummary: { type: "string" },
    faqSuggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer"],
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
        },
      },
    },
    imageAltTextSuggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["imageId", "altText"],
        properties: {
          imageId: { type: "string" },
          altText: { type: "string" },
        },
      },
    },
    metaTitle: { type: "string" },
    metaDescription: { type: "string" },
    agenticVisibilitySignals: {
      type: "object",
      additionalProperties: false,
      required: ["primaryIntents", "comparisonHooks", "trustSignals", "faqCoverage"],
      properties: {
        primaryIntents: { type: "array", items: { type: "string" } },
        comparisonHooks: { type: "array", items: { type: "string" } },
        trustSignals: { type: "array", items: { type: "string" } },
        faqCoverage: { type: "array", items: { type: "string" } },
      },
    },
    complianceWarnings: { type: "array", items: { type: "string" } },
    missingDataNotices: { type: "array", items: { type: "string" } },
    sourceFactsUsed: { type: "array", items: { type: "string" } },
    claimsRejected: { type: "array", items: { type: "string" } },
    qualityScores: {
      type: "object",
      additionalProperties: false,
      required: [
        "schemaValidity",
        "factualGrounding",
        "supplementCompliance",
        "agenticVisibility",
        "conversionQuality",
        "missingDataBehavior",
        "brandVoice",
        "sourceUseTransparency",
      ],
      properties: {
        schemaValidity: { type: "number" },
        factualGrounding: { type: "number" },
        supplementCompliance: { type: "number" },
        agenticVisibility: { type: "number" },
        conversionQuality: { type: "number" },
        missingDataBehavior: { type: "number" },
        brandVoice: { type: "number" },
        sourceUseTransparency: { type: "number" },
      },
    },
    channelVariants: {
      type: "object",
      additionalProperties: false,
      required: ["shopify", "optibay", "optiwal", "optizon", "genericMarketplace"],
      properties: {
        shopify: { type: ["string", "null"] },
        optibay: { type: ["string", "null"] },
        optiwal: { type: ["string", "null"] },
        optizon: { type: ["string", "null"] },
        genericMarketplace: { type: ["string", "null"] },
      },
    },
    generationMetadata: {
      type: "object",
      additionalProperties: false,
      required: ["contractVersion", "generatedAt", "sourceMode", "model"],
      properties: {
        contractVersion: { type: "string" },
        generatedAt: { type: "string" },
        sourceMode: { type: "string", enum: ["fixture", "manual", "all_product", "unknown"] },
        model: { type: ["string", "null"] },
      },
    },
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isScoreRange(value: unknown): value is number {
  return isNumber(value) && value >= 0 && value <= 100;
}

function parseIso(input: unknown): string | null {
  if (!isString(input)) return null;
  const parsed = Date.parse(input);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function validateProductCopywritingOutput(input: unknown): ProductCopywritingOutputValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { ok: false, errors: ["output must be an object"], value: null };
  }

  const value = input as Record<string, unknown>;
  const requireString = (field: string) => {
    if (!isString(value[field])) errors.push(`${field} must be a string`);
  };

  requireString("optimizedTitle");
  requireString("listingSubtitle");
  requireString("shortDescription");
  requireString("fullDescription");
  requireString("usageSummary");
  requireString("metaTitle");
  requireString("metaDescription");

  if (!isStringArray(value.benefitBullets)) errors.push("benefitBullets must be a string[]");
  if (!isStringArray(value.ingredientHighlights)) errors.push("ingredientHighlights must be a string[]");
  if (!isStringArray(value.complianceWarnings)) errors.push("complianceWarnings must be a string[]");
  if (!isStringArray(value.missingDataNotices)) errors.push("missingDataNotices must be a string[]");
  if (!isStringArray(value.sourceFactsUsed)) errors.push("sourceFactsUsed must be a string[]");
  if (!isStringArray(value.claimsRejected)) errors.push("claimsRejected must be a string[]");

  if (!Array.isArray(value.faqSuggestions) || !value.faqSuggestions.every((entry) => isRecord(entry) && isString(entry.question) && isString(entry.answer))) {
    errors.push("faqSuggestions must be an array of { question, answer }");
  }

  if (
    !Array.isArray(value.imageAltTextSuggestions)
    || !value.imageAltTextSuggestions.every((entry) => isRecord(entry) && isString(entry.imageId) && isString(entry.altText))
  ) {
    errors.push("imageAltTextSuggestions must be an array of { imageId, altText }");
  }

  const visibility = value.agenticVisibilitySignals;
  if (!isRecord(visibility)) {
    errors.push("agenticVisibilitySignals must be an object");
  } else {
    if (!isStringArray(visibility.primaryIntents)) errors.push("agenticVisibilitySignals.primaryIntents must be string[]");
    if (!isStringArray(visibility.comparisonHooks)) errors.push("agenticVisibilitySignals.comparisonHooks must be string[]");
    if (!isStringArray(visibility.trustSignals)) errors.push("agenticVisibilitySignals.trustSignals must be string[]");
    if (!isStringArray(visibility.faqCoverage)) errors.push("agenticVisibilitySignals.faqCoverage must be string[]");
  }

  const qualityScores = value.qualityScores;
  if (!isRecord(qualityScores)) {
    errors.push("qualityScores must be an object");
  } else {
    const scoreKeys = [
      "schemaValidity",
      "factualGrounding",
      "supplementCompliance",
      "agenticVisibility",
      "conversionQuality",
      "missingDataBehavior",
      "brandVoice",
      "sourceUseTransparency",
    ] as const;
    for (const key of scoreKeys) {
      if (!isScoreRange(qualityScores[key])) {
        errors.push(`qualityScores.${key} must be a number between 0 and 100`);
      }
    }
  }

  const channelVariants = value.channelVariants;
  if (!isRecord(channelVariants)) {
    errors.push("channelVariants must be an object");
  } else {
    const keys = ["shopify", "optibay", "optiwal", "optizon", "genericMarketplace"] as const;
    for (const key of keys) {
      if (!isNullableString(channelVariants[key])) {
        errors.push(`channelVariants.${key} must be string | null`);
      }
    }
  }

  const generationMetadata = value.generationMetadata;
  if (!isRecord(generationMetadata)) {
    errors.push("generationMetadata must be an object");
  } else {
    if (!isString(generationMetadata.contractVersion)) errors.push("generationMetadata.contractVersion must be a string");
    if (!parseIso(generationMetadata.generatedAt)) errors.push("generationMetadata.generatedAt must be an ISO date");
    if (
      generationMetadata.sourceMode !== "fixture"
      && generationMetadata.sourceMode !== "manual"
      && generationMetadata.sourceMode !== "all_product"
      && generationMetadata.sourceMode !== "unknown"
    ) {
      errors.push("generationMetadata.sourceMode must be fixture|manual|all_product|unknown");
    }
    if (!isNullableString(generationMetadata.model)) errors.push("generationMetadata.model must be string | null");
  }

  if (errors.length > 0) {
    return { ok: false, errors, value: null };
  }

  return { ok: true, errors: [], value: value as unknown as ProductCopywritingOutput };
}

export function parseProductCopywritingOutput(input: unknown): ProductCopywritingOutput {
  const result = validateProductCopywritingOutput(input);
  if (!result.ok || !result.value) {
    throw new Error(`Invalid ProductCopywritingOutput: ${result.errors.join("; ")}`);
  }
  return result.value;
}
