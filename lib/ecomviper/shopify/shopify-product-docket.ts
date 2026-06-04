import {
  ensureSingleFdaDisclaimer,
  supplementComplianceGuardrails,
  validateShopifySupplementCompliance,
} from "@/lib/ecomviper/shopify/shopify-supplement-compliance";
import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";
import type {
  ShopifyWorkspaceHydrationMode,
  ShopifyWorkspaceSource,
  ShopifyWorkspaceSourceLabel,
} from "@/lib/ecomviper/shopify/shopify-source-provenance";

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function stripHtml(input: string): string {
  if (!input.trim()) return "";
  return cleanText(input.replace(/<[^>]+>/g, " "));
}

function truncate(input: string, max: number): string {
  const normalized = cleanText(input);
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => cleanText(value)).filter(Boolean)));
}

function normalizeStatus(value: string): string {
  return cleanText(value) || "unknown";
}

export interface ShopifyDocketImage {
  id: string;
  url: string;
  altText: string;
  source: "product" | "variant";
}

export interface ShopifyDocketVariantBasic {
  id: string;
  title: string;
  sku: string;
  barcode: string;
  price: number | null;
  compareAtPrice: number | null;
  inventoryQuantity: number | null;
}

export interface ShopifyDocketMetafield {
  id: string;
  namespace: string;
  key: string;
  type: string;
  value: string;
  description: string | null;
}

export interface ShopifyCurrentListingDocket {
  productId: string;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  productType: string;
  tags: string[];
  collections: string[];
  descriptionText: string;
  descriptionHtml: string;
  seoTitle: string;
  seoDescription: string;
  productUrl: string;
  canonicalUrl: string;
  primaryImageUrl: string;
  images: ShopifyDocketImage[];
  variants: ShopifyDocketVariantBasic[];
  metafields: ShopifyDocketMetafield[];
  source: ShopifyWorkspaceSource;
  sourceLabel: ShopifyWorkspaceSourceLabel;
  hydrationMode: ShopifyWorkspaceHydrationMode;
  lastSyncedAt: string | null;
  fetchedAt: string;
}

export interface ShopifyDocketBeforeAfterRow {
  field:
    | "title"
    | "description"
    | "seoTitle"
    | "seoDescription"
    | "tags"
    | "productType"
    | "imageAltText";
  before: string;
  after: string;
}

export interface ShopifyOptimizedProposalDocket {
  title: string;
  descriptionText: string;
  seoTitle: string;
  seoDescription: string;
  imageAltTextByImageId: Record<string, string>;
  tags: string[];
  productTypeSuggestion: string;
  metafieldSuggestions: ShopifyDocketMetafield[];
  collectionSuggestions: string[];
  complianceSafeSupplementGuardrails: string[];
  confidenceNotes: string[];
  beforeAfterSummary: ShopifyDocketBeforeAfterRow[];
  generatedAt: string;
  sourceLabel: "Live OpenAI" | "Rule-based fallback";
}

export interface ShopifyEditableDraftDocket {
  title: string;
  descriptionText: string;
  seoTitle: string;
  seoDescription: string;
  tagsText: string;
  productType: string;
  imageAltTextByImageId: Record<string, string>;
  metafields: ShopifyDocketMetafield[];
  variants: ShopifyDocketVariantBasic[];
  collectionSuggestions: string[];
}

export interface ShopifyDraftChangeRow {
  field: string;
  before: string;
  after: string;
  apiPushable: boolean;
}

export interface BuildCurrentDocketOptions {
  source: ShopifyWorkspaceSource;
  sourceLabel: ShopifyWorkspaceSourceLabel;
  hydrationMode: ShopifyWorkspaceHydrationMode;
  lastSyncedAt: string | null;
  collections?: string[];
}

export function buildCurrentShopifyListingDocket(
  product: ShopifyProductRecord,
  options: BuildCurrentDocketOptions
): ShopifyCurrentListingDocket {
  const descriptionText = cleanText(product.description || stripHtml(product.descriptionHtml));
  const images: ShopifyDocketImage[] = product.galleryImages.map((image) => ({
    id: image.id || image.url,
    url: image.url,
    altText: cleanText(image.altText || ""),
    source: image.source,
  }));
  const variants: ShopifyDocketVariantBasic[] = product.variants.map((variant) => ({
    id: variant.id,
    title: cleanText(variant.title),
    sku: cleanText(variant.sku),
    barcode: cleanText(variant.barcode),
    price: variant.price,
    compareAtPrice: variant.compareAtPrice,
    inventoryQuantity: variant.inventoryQuantity,
  }));
  const metafields: ShopifyDocketMetafield[] = product.metafields.map((metafield) => ({
    id: metafield.id,
    namespace: cleanText(metafield.namespace),
    key: cleanText(metafield.key),
    type: cleanText(metafield.type),
    value: cleanText(metafield.value),
    description: metafield.description ? cleanText(metafield.description) : null,
  }));

  return {
    productId: cleanText(product.id),
    title: cleanText(product.title) || "Untitled product",
    handle: cleanText(product.handle),
    status: normalizeStatus(product.status),
    vendor: cleanText(product.vendor) || "Not available",
    productType: cleanText(product.productType) || "Not available",
    tags: dedupe(product.tags),
    collections: dedupe(options.collections ?? []),
    descriptionText,
    descriptionHtml: cleanText(product.descriptionHtml),
    seoTitle: cleanText(product.seoTitle),
    seoDescription: cleanText(product.seoDescription),
    productUrl: cleanText(product.onlineStoreUrl),
    canonicalUrl: cleanText(product.onlineStoreUrl),
    primaryImageUrl: cleanText(product.primaryImageUrl),
    images,
    variants,
    metafields,
    source: options.source,
    sourceLabel: options.sourceLabel,
    hydrationMode: options.hydrationMode,
    lastSyncedAt: options.lastSyncedAt,
    fetchedAt: new Date().toISOString(),
  };
}

function buildOptimizedTags(input: ShopifyCurrentListingDocket): string[] {
  const titleTerms = cleanText(input.title)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((term) => term.length >= 4)
    .slice(0, 4);
  const typeTerms = cleanText(input.productType)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((term) => term.length >= 4)
    .slice(0, 2);
  return dedupe([...input.tags, ...titleTerms, ...typeTerms]).slice(0, 15);
}

function buildImageAltTextById(input: ShopifyCurrentListingDocket, title: string): Record<string, string> {
  const values: Record<string, string> = {};
  input.images.forEach((image, index) => {
    values[image.id] =
      cleanText(image.altText) ||
      cleanText(`${title} product image ${index + 1}`);
  });
  return values;
}

function replaceBlockedPhrase(text: string, blockedPhrase: string): string {
  const escaped = blockedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "ig"), "supports daily wellness");
}

export function buildOptimizedShopifyProposal(
  current: ShopifyCurrentListingDocket,
  options?: { openAiConnected?: boolean }
): ShopifyOptimizedProposalDocket {
  const sourceLabel = options?.openAiConnected ? "Live OpenAI" : "Rule-based fallback";
  const baseTitle =
    cleanText(current.title).length < 40 && cleanText(current.vendor) && cleanText(current.vendor) !== "Not available"
      ? `${cleanText(current.vendor)} ${cleanText(current.title)}`
      : cleanText(current.title);
  const optimizedTitle = truncate(baseTitle, 70) || current.title;

  const currentDescription = cleanText(current.descriptionText || stripHtml(current.descriptionHtml));
  const compliance = validateShopifySupplementCompliance(currentDescription);
  let optimizedDescription = currentDescription;
  for (const blockedPhrase of compliance.blockedPhrases) {
    optimizedDescription = replaceBlockedPhrase(optimizedDescription, blockedPhrase);
  }
  if (optimizedDescription && !validateShopifySupplementCompliance(optimizedDescription).disclaimerIncluded) {
    optimizedDescription = ensureSingleFdaDisclaimer(optimizedDescription);
  }

  const optimizedSeoTitle = truncate(cleanText(current.seoTitle) || optimizedTitle, 70);
  const optimizedSeoDescription = truncate(
    cleanText(current.seoDescription) || cleanText(optimizedDescription || currentDescription),
    160
  );
  const tags = buildOptimizedTags(current);
  const productTypeSuggestion = cleanText(current.productType) || cleanText(current.vendor) || "General";
  const imageAltTextByImageId = buildImageAltTextById(current, optimizedTitle);
  const collectionSuggestions = dedupe([
    cleanText(current.productType),
    current.tags[0] || "",
  ]).filter(Boolean);
  const metafieldSuggestions: ShopifyDocketMetafield[] = [
    {
      id: "suggested:content.ai.optimized_at",
      namespace: "content",
      key: "ai_optimized_at",
      type: "single_line_text_field",
      value: new Date().toISOString(),
      description: "Suggested timestamp for AI optimization review.",
    },
  ];

  const beforeAfterSummary: ShopifyDocketBeforeAfterRow[] = [];
  if (optimizedTitle !== current.title) {
    beforeAfterSummary.push({ field: "title", before: current.title, after: optimizedTitle });
  }
  if (cleanText(optimizedDescription) !== cleanText(currentDescription)) {
    beforeAfterSummary.push({
      field: "description",
      before: truncate(currentDescription, 140),
      after: truncate(optimizedDescription, 140),
    });
  }
  if (optimizedSeoTitle !== cleanText(current.seoTitle)) {
    beforeAfterSummary.push({
      field: "seoTitle",
      before: current.seoTitle || "Not available",
      after: optimizedSeoTitle,
    });
  }
  if (optimizedSeoDescription !== cleanText(current.seoDescription)) {
    beforeAfterSummary.push({
      field: "seoDescription",
      before: current.seoDescription || "Not available",
      after: optimizedSeoDescription,
    });
  }
  if (tags.join(", ") !== current.tags.join(", ")) {
    beforeAfterSummary.push({
      field: "tags",
      before: current.tags.join(", ") || "Not available",
      after: tags.join(", "),
    });
  }
  if (productTypeSuggestion !== cleanText(current.productType)) {
    beforeAfterSummary.push({
      field: "productType",
      before: current.productType || "Not available",
      after: productTypeSuggestion,
    });
  }
  if (current.images.some((image) => !cleanText(image.altText))) {
    beforeAfterSummary.push({
      field: "imageAltText",
      before: "Missing alt text on one or more images",
      after: "All current images include suggested alt text",
    });
  }

  const confidenceNotes = [
    `Source: ${current.sourceLabel}`,
    "Proposal generated from current Shopify listing fields only.",
    options?.openAiConnected
      ? "OpenAI connection is configured for optimization workflows."
      : "OpenAI is not connected; using deterministic optimization fallback.",
  ];

  return {
    title: optimizedTitle,
    descriptionText: optimizedDescription || currentDescription,
    seoTitle: optimizedSeoTitle,
    seoDescription: optimizedSeoDescription,
    imageAltTextByImageId,
    tags,
    productTypeSuggestion,
    metafieldSuggestions,
    collectionSuggestions,
    complianceSafeSupplementGuardrails: supplementComplianceGuardrails(),
    confidenceNotes,
    beforeAfterSummary,
    generatedAt: new Date().toISOString(),
    sourceLabel,
  };
}

export function buildEditableShopifyDraft(
  current: ShopifyCurrentListingDocket,
  proposal: ShopifyOptimizedProposalDocket | null
): ShopifyEditableDraftDocket {
  const effective = proposal
    ? {
        title: proposal.title,
        descriptionText: proposal.descriptionText,
        seoTitle: proposal.seoTitle,
        seoDescription: proposal.seoDescription,
        tags: proposal.tags,
        productType: proposal.productTypeSuggestion,
        imageAltTextByImageId: proposal.imageAltTextByImageId,
        metafields: proposal.metafieldSuggestions,
        collectionSuggestions: proposal.collectionSuggestions,
      }
    : {
        title: current.title,
        descriptionText: current.descriptionText,
        seoTitle: current.seoTitle,
        seoDescription: current.seoDescription,
        tags: current.tags,
        productType: current.productType,
        imageAltTextByImageId: buildImageAltTextById(current, current.title),
        metafields: current.metafields,
        collectionSuggestions: current.collections,
      };

  return {
    title: effective.title,
    descriptionText: effective.descriptionText,
    seoTitle: effective.seoTitle,
    seoDescription: effective.seoDescription,
    tagsText: effective.tags.join(", "),
    productType: effective.productType,
    imageAltTextByImageId: { ...effective.imageAltTextByImageId },
    metafields: effective.metafields.map((entry) => ({ ...entry })),
    variants: current.variants.map((variant) => ({ ...variant })),
    collectionSuggestions: effective.collectionSuggestions,
  };
}

export function summarizeDraftChanges(
  current: ShopifyCurrentListingDocket,
  draft: ShopifyEditableDraftDocket
): ShopifyDraftChangeRow[] {
  const rows: ShopifyDraftChangeRow[] = [];

  function pushRow(field: string, before: string, after: string, apiPushable = true) {
    if (cleanText(before) === cleanText(after)) return;
    rows.push({ field, before: before || "Not available", after: after || "Not available", apiPushable });
  }

  pushRow("Title", current.title, draft.title);
  pushRow("Description", truncate(current.descriptionText, 140), truncate(draft.descriptionText, 140));
  pushRow("SEO title", current.seoTitle, draft.seoTitle);
  pushRow("SEO description", current.seoDescription, draft.seoDescription);
  pushRow("Tags", current.tags.join(", "), draft.tagsText);
  pushRow("Product type", current.productType, draft.productType);

  const currentAltById = buildImageAltTextById(current, current.title);
  for (const image of current.images) {
    const before = currentAltById[image.id] || "";
    const after = cleanText(draft.imageAltTextByImageId[image.id] || "");
    pushRow(`Image alt text (${image.id})`, before, after);
  }

  if (draft.collectionSuggestions.join(", ") !== current.collections.join(", ")) {
    rows.push({
      field: "Collection suggestions",
      before: current.collections.join(", ") || "Not available",
      after: draft.collectionSuggestions.join(", ") || "Not available",
      apiPushable: false,
    });
  }

  return rows;
}
