import type { ShopifyCurrentListingDocket } from "@/lib/ecomviper/shopify/shopify-product-docket";
import type { ShopifyProductEditorInitialState, ShopifyProductEditorSourceFacts } from "@/lib/ecomviper/shopify/shopify-product-editor-state";
import type { SupplierFactsPanelViewModel } from "@/lib/ecommerce/supplier-facts-types";
import type { RocktomicSupplierProduct } from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";
import type { ProductCopywritingInput, ProductChannel } from "@/lib/ecomviper/copywriting-agent/copywriting-agent-types";

interface ProductCopywritingBuildContext {
  channel?: ProductChannel;
  productIdentity?: Partial<ProductCopywritingInput["productIdentity"]>;
  currentListing?: Partial<ProductCopywritingInput["currentListing"]>;
  variants?: ProductCopywritingInput["variants"];
  images?: ProductCopywritingInput["images"];
  supplierContext?: Partial<ProductCopywritingInput["supplierContext"]>;
  supplementFacts?: Partial<ProductCopywritingInput["supplementFacts"]>;
  sourceEvidence?: Partial<ProductCopywritingInput["sourceEvidence"]>;
  brandVoice?: Partial<ProductCopywritingInput["brandVoice"]>;
  complianceProfile?: Partial<ProductCopywritingInput["complianceProfile"]>;
  agenticVisibilityProfile?: Partial<ProductCopywritingInput["agenticVisibilityProfile"]>;
  outputTargets?: Partial<ProductCopywritingInput["outputTargets"]>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

function dedupe(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function hasStructuredSupplementFacts(input: {
  servingSize: string | null;
  servingsPerContainer: string | null;
  activeIngredients: string[];
  ingredientAmounts: string[];
}): boolean {
  return Boolean(
    input.servingSize
    || input.servingsPerContainer
    || input.activeIngredients.length > 0
    || input.ingredientAmounts.length > 0
  );
}

function summarizeSourceFactState(input: {
  supplementFacts: ProductCopywritingInput["supplementFacts"];
  coaPresent: boolean;
}): string[] {
  return dedupe([
    input.supplementFacts.activeIngredients.length > 0 || input.supplementFacts.ingredientAmounts.length > 0
      ? "supplement_facts:extracted"
      : "supplement_facts:missing",
    input.supplementFacts.servingSize ? "serving_size:present" : "serving_size:missing",
    input.supplementFacts.servingsPerContainer ? "servings_per_container:present" : "servings_per_container:missing",
    input.supplementFacts.ingredientAmounts.length > 0 ? "ingredient_amounts:present" : "ingredient_amounts:missing",
    input.supplementFacts.otherIngredients.length > 0 ? "other_ingredients:present" : "other_ingredients:missing",
    input.coaPresent ? "coa_status:available" : "coa_status:missing",
  ]);
}

function inferProductClass(input: { productType: string | null; supplementFacts: { activeIngredients: string[]; servingSize: string | null } }): "supplement" | "non_supplement" | "unknown" {
  const type = (input.productType || "").toLowerCase();
  if (type.includes("supplement") || type.includes("vitamin") || type.includes("gummies")) return "supplement";
  if (input.supplementFacts.activeIngredients.length > 0 || input.supplementFacts.servingSize) return "supplement";
  if (input.productType) return "non_supplement";
  return "unknown";
}

function defaultForbiddenTerms(): string[] {
  return [
    "cure",
    "treat",
    "diagnose",
    "prevent disease",
    "drug alternative",
    "clinically proven cure",
  ];
}

export function buildProductCopywritingInput(context: ProductCopywritingBuildContext): ProductCopywritingInput {
  const channel = context.channel || context.productIdentity?.channel || "unknown";
  const title = asString(context.productIdentity?.title) || asString(context.currentListing?.title) || "Untitled product";

  const supplementFacts: ProductCopywritingInput["supplementFacts"] = {
    servingSize: asNullableString(context.supplementFacts?.servingSize),
    servingsPerContainer: asNullableString(context.supplementFacts?.servingsPerContainer),
    activeIngredients: dedupe(context.supplementFacts?.activeIngredients || []),
    ingredientAmounts: dedupe(context.supplementFacts?.ingredientAmounts || []),
    otherIngredients: dedupe(context.supplementFacts?.otherIngredients || []),
    suggestedUse: asNullableString(context.supplementFacts?.suggestedUse),
    warnings: asNullableString(context.supplementFacts?.warnings),
  };

  const supplierContext: ProductCopywritingInput["supplierContext"] = {
    supplierSlug: asNullableString(context.supplierContext?.supplierSlug),
    supplierName: asNullableString(context.supplierContext?.supplierName),
    supplierSku: asNullableString(context.supplierContext?.supplierSku),
    supplierProductName: asNullableString(context.supplierContext?.supplierProductName),
    matchStatus: context.supplierContext?.matchStatus || "no_match",
    matchConfidence: asNullableString(context.supplierContext?.matchConfidence),
    matchReasons: dedupe(context.supplierContext?.matchReasons || []),
    ingredientMatchingReadiness: asNullableString(context.supplierContext?.ingredientMatchingReadiness),
    productEditorFactsReadiness: asNullableString(context.supplierContext?.productEditorFactsReadiness),
    complianceEvidenceReadiness: asNullableString(context.supplierContext?.complianceEvidenceReadiness),
    pricingReadiness: asNullableString(context.supplierContext?.pricingReadiness),
    inventoryReadiness: asNullableString(context.supplierContext?.inventoryReadiness),
    optiPixelAssetReadiness: asNullableString(context.supplierContext?.optiPixelAssetReadiness),
  };

  const sourceEvidence: ProductCopywritingInput["sourceEvidence"] = {
    coaPresent: Boolean(context.sourceEvidence?.coaPresent),
    coaUrl: asNullableString(context.sourceEvidence?.coaUrl),
    labelEvidencePresent: Boolean(context.sourceEvidence?.labelEvidencePresent),
    supplementFactsImagePresent: Boolean(context.sourceEvidence?.supplementFactsImagePresent),
    aiLabelTextEvidencePresent: Boolean(context.sourceEvidence?.aiLabelTextEvidencePresent),
    aiLabelTextEvidenceStatus: asNullableString(context.sourceEvidence?.aiLabelTextEvidenceStatus),
    aiLabelTextNeedsReview: Boolean(context.sourceEvidence?.aiLabelTextNeedsReview),
    structuredSupplementFactsPresent: Boolean(context.sourceEvidence?.structuredSupplementFactsPresent),
    supplementFactsSource: context.sourceEvidence?.supplementFactsSource || "unknown",
    sourceFactsUsed: dedupe(context.sourceEvidence?.sourceFactsUsed || []),
  };

  const variants = (context.variants || []).map((variant) => ({
    sku: asNullableString(variant.sku),
    barcode: asNullableString(variant.barcode),
    upc: asNullableString(variant.upc),
    gtin: asNullableString(variant.gtin),
    price: typeof variant.price === "number" && Number.isFinite(variant.price) ? variant.price : null,
    compareAtPrice: typeof variant.compareAtPrice === "number" && Number.isFinite(variant.compareAtPrice) ? variant.compareAtPrice : null,
    inventory: typeof variant.inventory === "number" && Number.isFinite(variant.inventory) ? variant.inventory : null,
  }));

  const images: ProductCopywritingInput["images"] = {
    selectedPrimaryImageUrl: asNullableString(context.images?.selectedPrimaryImageUrl),
    items: (context.images?.items || []).map((image) => ({
      id: asString(image.id) || image.url,
      url: asString(image.url),
      altText: asNullableString(image.altText),
      filename: asNullableString(image.filename),
      role: asNullableString(image.role),
      order: typeof image.order === "number" && Number.isFinite(image.order) ? image.order : null,
    })).filter((image) => image.url.length > 0),
  };

  const productType = asNullableString(context.productIdentity?.productType);
  const productClass = context.complianceProfile?.productClass || inferProductClass({ productType, supplementFacts });

  const structuredSupplementFactsPresent =
    sourceEvidence.structuredSupplementFactsPresent
    || hasStructuredSupplementFacts(supplementFacts);
  const servingSizeMissing = !supplementFacts.servingSize;
  const servingsPerContainerMissing = !supplementFacts.servingsPerContainer;
  const ingredientFactsMissing =
    supplementFacts.activeIngredients.length === 0
    && supplementFacts.ingredientAmounts.length === 0;
  const ingredientAmountsMissing = supplementFacts.ingredientAmounts.length === 0;
  const supplementFactsImagePresent = sourceEvidence.supplementFactsImagePresent || sourceEvidence.labelEvidencePresent;
  const supplementFactsImageOnly = supplementFactsImagePresent && !structuredSupplementFactsPresent;
  const supplementFactsMissing =
    !structuredSupplementFactsPresent
    && !sourceEvidence.aiLabelTextEvidencePresent
    && !supplementFactsImagePresent;

  const missingData = {
    coaMissing: !sourceEvidence.coaPresent,
    pricingMissing: variants.length === 0 || !variants.some((variant) => variant.price != null || variant.compareAtPrice != null),
    inventoryMissing: variants.length === 0 || !variants.some((variant) => variant.inventory != null),
    supplementFactsMissing,
    supplierMatchMissing: supplierContext.matchStatus === "no_match" || supplierContext.matchStatus === "unavailable",
    ingredientFactsMissing,
    structuredSupplementFactsMissing: !structuredSupplementFactsPresent,
    servingSizeMissing,
    servingsPerContainerMissing,
    ingredientAmountsMissing,
    supplementFactsImageOnly,
    supplementFactsTextNeedsReview: sourceEvidence.aiLabelTextNeedsReview,
  };

  return {
    productIdentity: {
      productId: asString(context.productIdentity?.productId) || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown-product",
      handle: asNullableString(context.productIdentity?.handle),
      title,
      brand: asNullableString(context.productIdentity?.brand),
      productType,
      category: asNullableString(context.productIdentity?.category),
      tags: dedupe(context.productIdentity?.tags || []),
      vendor: asNullableString(context.productIdentity?.vendor),
      channel,
    },
    currentListing: {
      title: asString(context.currentListing?.title) || title,
      descriptionText: asString(context.currentListing?.descriptionText),
      descriptionHtml: asString(context.currentListing?.descriptionHtml),
      bullets: dedupe(context.currentListing?.bullets || []),
      metaTitle: asString(context.currentListing?.metaTitle),
      metaDescription: asString(context.currentListing?.metaDescription),
      existingFaqs: (context.currentListing?.existingFaqs || []).map((faq) => ({ question: asString(faq.question), answer: asString(faq.answer) })).filter((faq) => faq.question || faq.answer),
    },
    variants,
    images,
    supplierContext,
    supplementFacts,
    sourceEvidence,
    missingData,
    brandVoice: {
      tone: asString(context.brandVoice?.tone) || "clear, factual, conversion-focused",
      forbiddenTerms: dedupe(context.brandVoice?.forbiddenTerms || defaultForbiddenTerms()),
      preferredTerms: dedupe(context.brandVoice?.preferredTerms || ["supports", "source-backed", "as directed"]),
      styleGuide: dedupe(context.brandVoice?.styleGuide || ["Use concise sentences.", "Avoid hype and unverifiable claims."]),
    },
    complianceProfile: {
      productClass,
      supplementRules: dedupe(context.complianceProfile?.supplementRules || [
        "Do not claim to diagnose, treat, cure, or prevent disease.",
        "Use structure/function style claims only when source-backed.",
      ]),
      forbiddenClaimPatterns: dedupe(context.complianceProfile?.forbiddenClaimPatterns || defaultForbiddenTerms()),
      safeStructureFunctionLanguage: dedupe(context.complianceProfile?.safeStructureFunctionLanguage || [
        "supports daily wellness",
        "supports routine health goals",
      ]),
    },
    agenticVisibilityProfile: {
      targetSearchUseCases: dedupe(context.agenticVisibilityProfile?.targetSearchUseCases || ["what is it", "who is it for", "key ingredients"]),
      comparisonAttributes: dedupe(context.agenticVisibilityProfile?.comparisonAttributes || ["form", "serving size", "ingredient transparency"]),
      answerEngineSignals: dedupe(context.agenticVisibilityProfile?.answerEngineSignals || ["clear identity", "fact-backed summary", "FAQ coverage"]),
      faqCoverageTargets: dedupe(context.agenticVisibilityProfile?.faqCoverageTargets || ["usage", "ingredients", "warnings", "shipping"]),
      trustSignals: dedupe(context.agenticVisibilityProfile?.trustSignals || ["source facts", "COA status", "certifications when available"]),
    },
    outputTargets: {
      shopify: context.outputTargets?.shopify ?? channel === "shopify",
      optibay: context.outputTargets?.optibay ?? channel === "optibay",
      optiwal: context.outputTargets?.optiwal ?? channel === "optiwal",
      optizon: context.outputTargets?.optizon ?? channel === "optizon",
      genericMarketplace: context.outputTargets?.genericMarketplace ?? true,
    },
  };
}

function splitTextToList(value: string | null | undefined): string[] {
  return dedupe((value || "").split(/\n|,|;/g).map((entry) => entry.trim()).filter(Boolean));
}

function panelAmountPerServingToList(values: string[] | null | undefined): string[] {
  return dedupe(
    (values || [])
      .flatMap((value) => splitTextToList(value))
      .filter(Boolean)
  );
}

function mapSourceFactsToIngredients(sourceFacts: ShopifyProductEditorSourceFacts | null | undefined): ProductCopywritingInput["supplementFacts"] {
  return {
    servingSize: sourceFacts?.servingSize?.value || null,
    servingsPerContainer: sourceFacts?.servingsPerContainer?.value || null,
    activeIngredients: dedupe(sourceFacts?.activeIngredients?.values || []),
    ingredientAmounts: splitTextToList(sourceFacts?.amountPerServing?.value),
    otherIngredients: splitTextToList(sourceFacts?.otherIngredients?.value),
    suggestedUse: null,
    warnings: null,
  };
}

function mapSupplierToSupplementFacts(product: RocktomicSupplierProduct | null | undefined): ProductCopywritingInput["supplementFacts"] {
  return {
    servingSize: product?.servingSize || null,
    servingsPerContainer: product?.servingsPerContainer || null,
    activeIngredients: dedupe(product?.activeIngredients || []),
    ingredientAmounts: splitTextToList(product?.amountPerServing || null),
    otherIngredients: splitTextToList(product?.otherIngredients || null),
    suggestedUse: product?.suggestedUse?.value || null,
    warnings: product?.warnings?.value || null,
  };
}

function fromShopifyListing(product: ShopifyCurrentListingDocket): Pick<ProductCopywritingBuildContext, "productIdentity" | "currentListing" | "variants" | "images"> {
  return {
    productIdentity: {
      productId: product.productId,
      handle: product.handle || null,
      title: product.title,
      brand: product.vendor || null,
      productType: product.productType || null,
      category: product.productType || null,
      tags: product.tags,
      vendor: product.vendor || null,
      channel: "shopify",
    },
    currentListing: {
      title: product.title,
      descriptionText: product.descriptionText,
      descriptionHtml: product.descriptionHtml,
      bullets: [],
      metaTitle: product.seoTitle,
      metaDescription: product.seoDescription,
      existingFaqs: [],
    },
    variants: product.variants.map((variant) => ({
      sku: variant.sku || null,
      barcode: variant.barcode || null,
      upc: null,
      gtin: null,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      inventory: variant.inventoryQuantity,
    })),
    images: {
      selectedPrimaryImageUrl: product.primaryImageUrl || null,
      items: product.images.map((image, index) => ({
        id: image.id || image.url,
        url: image.url,
        altText: image.altText || null,
        filename: image.url.split("/").pop() || null,
        role: image.source,
        order: index,
      })),
    },
  };
}

export function buildProductCopywritingInputFromShopifyEditorState(initialState: ShopifyProductEditorInitialState): ProductCopywritingInput | null {
  const product = initialState.currentShopifyListing;
  if (!product) return null;

  const sourceFacts = initialState.sourceFacts || null;
  const supplierContextState = initialState.supplierContext;
  const supplier = supplierContextState?.product || null;
  const supplierFactsPanel = initialState.supplierFactsPanel || null;

  const baseListing = fromShopifyListing(product);
  const sourceSupplementFacts = mapSourceFactsToIngredients(sourceFacts);
  const supplierSupplementFacts = mapSupplierToSupplementFacts(supplier);
  const panelSupplementFacts: ProductCopywritingInput["supplementFacts"] = {
    servingSize: supplierFactsPanel?.servingSize || null,
    servingsPerContainer: supplierFactsPanel?.servingsPerContainer || null,
    activeIngredients: dedupe(supplierFactsPanel?.activeIngredients || []),
    ingredientAmounts: panelAmountPerServingToList(supplierFactsPanel?.ingredientAmounts),
    otherIngredients: dedupe(supplierFactsPanel?.otherIngredients || []),
    suggestedUse: supplierFactsPanel?.directions || null,
    warnings: supplierFactsPanel?.warnings || null,
  };

  const supplementFacts: ProductCopywritingInput["supplementFacts"] = {
    servingSize: sourceSupplementFacts.servingSize || panelSupplementFacts.servingSize || supplierSupplementFacts.servingSize,
    servingsPerContainer: sourceSupplementFacts.servingsPerContainer || panelSupplementFacts.servingsPerContainer || supplierSupplementFacts.servingsPerContainer,
    activeIngredients: dedupe([
      ...sourceSupplementFacts.activeIngredients,
      ...panelSupplementFacts.activeIngredients,
      ...supplierSupplementFacts.activeIngredients,
    ]),
    ingredientAmounts: dedupe([
      ...sourceSupplementFacts.ingredientAmounts,
      ...panelSupplementFacts.ingredientAmounts,
      ...supplierSupplementFacts.ingredientAmounts,
    ]),
    otherIngredients: dedupe([
      ...sourceSupplementFacts.otherIngredients,
      ...panelSupplementFacts.otherIngredients,
      ...supplierSupplementFacts.otherIngredients,
    ]),
    suggestedUse: sourceSupplementFacts.suggestedUse || panelSupplementFacts.suggestedUse || supplierSupplementFacts.suggestedUse,
    warnings: sourceSupplementFacts.warnings || panelSupplementFacts.warnings || supplierSupplementFacts.warnings,
  };

  const supplierContext: ProductCopywritingBuildContext["supplierContext"] = {
    supplierSlug: supplierFactsPanel?.supplierSlug || (supplier ? "rocktomic" : null),
    supplierName: supplierFactsPanel?.supplierName || supplier?.supplier || null,
    supplierSku: supplierFactsPanel?.supplierSku || supplierContextState?.matchedSku || null,
    supplierProductName: supplierFactsPanel?.supplierProductName || supplier?.productName || null,
    matchStatus: supplierFactsPanel?.matchStatus === "matched"
      ? "matched"
      : supplierFactsPanel?.matchStatus === "candidate"
        ? "candidate"
        : supplierContextState?.matched
          ? "matched"
          : "no_match",
    matchConfidence: supplierFactsPanel?.matchConfidence || supplierContextState?.matchReason || null,
    matchReasons: supplierFactsPanel?.matchReasons || [supplierContextState?.matchReason],
    ingredientMatchingReadiness: supplierFactsPanel?.readiness?.ingredientMatching || null,
    productEditorFactsReadiness: supplierFactsPanel?.readiness?.productEditorFacts || null,
    complianceEvidenceReadiness: supplierFactsPanel?.readiness?.complianceEvidence || null,
    pricingReadiness: supplierFactsPanel?.readiness?.pricing || null,
    inventoryReadiness: supplierFactsPanel?.readiness?.inventory || null,
    optiPixelAssetReadiness: supplierFactsPanel?.readiness?.optiPixelAssets || null,
  };

  const sourceEvidence: ProductCopywritingBuildContext["sourceEvidence"] = (() => {
    const hasStructuredFacts = hasStructuredSupplementFacts(supplementFacts);
    const sourceMethod = (supplierFactsPanel?.evidence?.sourceMethod || "").toLowerCase();
    const hasImageEvidence = Boolean(
      sourceFacts?.assets?.labelTemplateUrl
      || sourceFacts?.assets?.mockupUrl
      || supplierFactsPanel?.assetSummary?.labelTemplateAiPresent
      || supplierFactsPanel?.assetSummary?.mockupTemplateTifPresent
      || supplier?.labelTemplate?.url
      || supplier?.mockup?.url
    );
    const coaPresent = Boolean(sourceFacts?.assets?.coaUrl || supplierFactsPanel?.assetSummary?.coaPresent || supplier?.coa?.url);

    const supplementFactsSource =
      hasStructuredFacts
        ? sourceMethod.includes("artifact")
          ? "artifact"
          : sourceMethod.includes("ai")
            ? "ai_label_text"
            : "db"
        : supplierFactsPanel?.evidence?.aiLabelTextEvidenceStatus && supplierFactsPanel.evidence.aiLabelTextEvidenceStatus !== "unavailable"
          ? "ai_label_text"
          : hasImageEvidence
            ? "image_only"
            : "none";

    return {
      coaPresent,
      coaUrl: sourceFacts?.assets?.coaUrl || supplierFactsPanel?.assetSummary?.coaUrl || supplier?.coa?.url || null,
      labelEvidencePresent: Boolean(
        sourceFacts?.assets?.labelTemplateUrl
        || supplierFactsPanel?.assetSummary?.labelTemplateAiPresent
        || supplierFactsPanel?.assetSummary?.mockupTemplateTifPresent
        || supplier?.labelTemplate?.url
        || supplier?.mockup?.url
      ),
      supplementFactsImagePresent: hasImageEvidence,
      aiLabelTextEvidencePresent:
        Boolean(supplierFactsPanel?.evidence?.aiLabelTextEvidenceStatus)
        && supplierFactsPanel?.evidence?.aiLabelTextEvidenceStatus !== "unavailable",
      aiLabelTextEvidenceStatus: supplierFactsPanel?.evidence?.aiLabelTextEvidenceStatus || null,
      aiLabelTextNeedsReview: Boolean(supplierFactsPanel?.evidence?.needsReview),
      structuredSupplementFactsPresent: hasStructuredFacts,
      supplementFactsSource,
      sourceFactsUsed: summarizeSourceFactState({
        supplementFacts,
        coaPresent,
      }),
    };
  })();

  return buildProductCopywritingInput({
    channel: "shopify",
    ...baseListing,
    supplementFacts,
    supplierContext,
    sourceEvidence,
  });
}

export type { ProductCopywritingBuildContext };
