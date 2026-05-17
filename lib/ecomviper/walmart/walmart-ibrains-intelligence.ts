import type { WalmartEffectiveProductRecord } from "@/lib/ecomviper/walmart/walmart-product-display";
import { hostFromUrl, type WalmartNetworkConnection } from "@/lib/ecomviper/walmart/walmart-network-connections";

export type IBrainsOpportunityType =
  | "citation"
  | "community"
  | "marketplace"
  | "owned_content"
  | "image_media"
  | "backlink_outreach"
  | "competitor_gap"
  | "faq_gap";

export type IBrainsOpportunityStatus =
  | "new"
  | "draft_ready"
  | "needs_approval"
  | "approved"
  | "rejected"
  | "completed"
  | "monitoring";

export type IBrainsComplianceRisk = "low" | "medium" | "high";

export type IBrainsOpportunityDestinationType = "marketplace_listing" | "wordpress_site" | "manual" | "other";

export interface IBrainsOpportunityDestination {
  connectionId?: string;
  destinationName: string;
  destinationUrl?: string;
  platform: "walmart" | "wordpress" | "other";
  destinationType: IBrainsOpportunityDestinationType;
  recommendedAction: string;
  contentAngle?: string;
  whyThisDestination: string;
  fitScore?: number;
}

export interface IBrainsIntelligenceOpportunity {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  marketplace: "walmart";
  type: IBrainsOpportunityType;
  title: string;
  sourceName?: string;
  sourceDomain?: string;
  url?: string;
  snippet?: string;
  relevanceScore: number;
  citationPotentialScore: number;
  agenticVisibilityScore: number;
  complianceRisk: IBrainsComplianceRisk;
  recommendedAction: string;
  rationale: string;
  draftTitle?: string;
  draftBody?: string;
  status: IBrainsOpportunityStatus;
  createdAt: string;
  destination: IBrainsOpportunityDestination;
}

export interface IBrainsIntelligenceRun {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  marketplace: "walmart";
  status: "idle" | "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  queries?: string[];
  opportunities: IBrainsIntelligenceOpportunity[];
  summary: {
    agenticVisibilityScore: number;
    opportunitiesFound: number;
    highImpactActions: number;
    complianceWarnings: number;
    draftsReady: number;
    strongDestinationMatches: number;
    topDestinations: Array<{
      destinationName: string;
      destinationUrl?: string;
      platform: "walmart" | "wordpress" | "other";
      fitScore: number;
    }>;
  };
}

interface OpportunityTemplate {
  type: IBrainsOpportunityType;
  title: string;
  destinationHint: "walmart" | "wordpress" | "manual";
  recommendedActionTemplate: string;
  fallbackAction: string;
  rationale: string;
  contentAngle: string;
  desiredContentType: string;
  topicalKeywords: string[];
  draftTitle: string;
  draftBody: string;
  relevanceOffset: number;
  citationOffset: number;
  impactOffset: number;
}

export interface DestinationFit {
  connectionId: string;
  destinationName: string;
  destinationUrl?: string;
  platform: "wordpress";
  fitScore: number;
  rationale: string;
  recommendedAction: string;
  contentAngle: string;
}

const RISKY_CLAIM_PATTERNS = [
  /\btreat\b/i,
  /\bcure\b/i,
  /\bprevent\s+disease\b/i,
  /\breverse\b/i,
  /\bdiagnose\b/i,
  /\bguaranteed\b/i,
  /\bclinically\s+proven\s+to\s+treat\b/i,
  /\bworks\s+like\s+a\s+drug\b/i,
  /\bnatural\s+viagra\b/i,
  /\bhigh\s+blood\s+pressure\b/i,
  /\bhypertension\b/i,
  /\b\bed\b\b/i,
  /\banxiety\b/i,
  /\bdepression\b/i,
  /\binsomnia\b/i,
  /\bdisease\b/i,
];

const STOP_WORDS = new Set([
  "and",
  "the",
  "with",
  "for",
  "from",
  "this",
  "that",
  "your",
  "into",
  "about",
  "daily",
  "support",
  "walmart",
  "draft",
]);

const DESTINATION_MATCH_THRESHOLD = 55;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSkuKey(sku: string): string {
  return sku.trim().toUpperCase();
}

function countAttributes(record: Record<string, string> | undefined): number {
  if (!record) return 0;
  return Object.entries(record).filter(([key, value]) => key.trim() && value.trim()).length;
}

function isMeaningfulText(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return !new Set(["unknown", "n/a", "na", "none", "null", "undefined"]).has(normalized);
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function overlapCount(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  const rightSet = new Set(right);
  const seen = new Set<string>();
  for (const token of left) {
    if (rightSet.has(token)) seen.add(token);
  }
  return seen.size;
}

function inferBaseAgenticVisibilityScore(product: WalmartEffectiveProductRecord): number {
  const titleSignal = isMeaningfulText(product.title) ? 1 : 0;
  const shortDescriptionSignal = isMeaningfulText(product.shortDescription) ? 1 : 0;
  const longDescriptionSignal = isMeaningfulText(product.longDescription) ? 1 : 0;
  const bulletsSignal = product.bulletPoints.filter((entry) => isMeaningfulText(entry)).length;
  const mediaSignal = isMeaningfulText(product.imageUrl) ? 1 : 0;
  const altTextSignal = isMeaningfulText(product.altText ?? "") ? 1 : 0;

  const attributesCount = countAttributes(product.attributes);
  const searchBrowseCount = countAttributes(product.searchBrowseAttributes);

  const inventorySignal =
    product.inventoryStatus === "known" ? 1 : product.inventoryStatus === "out_of_stock" ? 0.3 : 0.5;
  const priceSignal = Number.isFinite(product.price) && product.price > 0 ? 1 : 0;

  const qualityScore =
    titleSignal * 12 +
    shortDescriptionSignal * 8 +
    longDescriptionSignal * 12 +
    Math.min(5, bulletsSignal) * 5 +
    Math.min(12, attributesCount) * 2 +
    Math.min(8, searchBrowseCount) * 2 +
    mediaSignal * 10 +
    altTextSignal * 6 +
    inventorySignal * 10 +
    priceSignal * 10;

  const issuePenalty = Math.min(25, (product.issues?.length ?? 0) * 4);
  return clampScore(25 + qualityScore - issuePenalty);
}

function inferComplianceRisk(input: {
  productRiskHits: string[];
  type: IBrainsOpportunityType;
}): IBrainsComplianceRisk {
  if (input.productRiskHits.length > 0) {
    if (input.type === "community" || input.type === "backlink_outreach") return "high";
    return "medium";
  }
  if (input.type === "community") return "medium";
  return "low";
}

function defaultStatusForOpportunity(input: {
  complianceRisk: IBrainsComplianceRisk;
  hasDraft: boolean;
}): IBrainsOpportunityStatus {
  if (input.complianceRisk === "high") return "needs_approval";
  if (input.hasDraft) return "draft_ready";
  return "new";
}

function buildOpportunityTemplates(product: WalmartEffectiveProductRecord): OpportunityTemplate[] {
  const productName = product.title || product.sku;

  return [
    {
      type: "owned_content",
      title: "Create destination-aware product review draft",
      destinationHint: "wordpress",
      recommendedActionTemplate: "Create WordPress product review draft on {destination}.",
      fallbackAction:
        "No strong matching connected property found for this topic yet. Create a draft for manual use or add a WordPress property for this niche.",
      rationale:
        "Owned product-review surfaces strengthen citation confidence for agentic recommendation and selection workflows.",
      contentAngle: `Best ${productName} options for daily wellness routines`,
      desiredContentType: "product review",
      topicalKeywords: ["product", "review", "buying", "guide", product.category],
      draftTitle: `${productName} review draft for owned media`,
      draftBody:
        `Draft angle: ${productName} product review with clear usage context and compliance-safe language.\n` +
        "Include factual product details and a Walmart listing reference for verification.",
      relevanceOffset: 9,
      citationOffset: 12,
      impactOffset: 12,
    },
    {
      type: "citation",
      title: "Create destination-aware buyer guide draft",
      destinationHint: "wordpress",
      recommendedActionTemplate: "Create WordPress buyer guide draft on {destination}.",
      fallbackAction:
        "No strong matching connected property found for this topic yet. Create a citation-ready draft for manual use and add a niche-matched WordPress property.",
      rationale:
        "Buyer-guide citations help assistants verify product facts and selection context.",
      contentAngle: `${productName} buyer guide and comparison essentials`,
      desiredContentType: "buyer guide",
      topicalKeywords: ["buyer", "guide", "comparison", "wellness", product.category],
      draftTitle: `${productName} citation-ready buyer guide draft`,
      draftBody:
        `Buyer guide structure for ${productName}: clear audience fit, ingredient facts, usage context, and Walmart listing link for source validation.`,
      relevanceOffset: 8,
      citationOffset: 14,
      impactOffset: 11,
    },
    {
      type: "marketplace",
      title: "Improve Walmart listing completeness",
      destinationHint: "walmart",
      recommendedActionTemplate: "Strengthen core listing fields directly on the Walmart listing draft.",
      fallbackAction: "Strengthen core listing fields directly on the Walmart listing draft.",
      rationale:
        "Walmart listing completeness increases discoverability and helps AI systems parse product facts cleanly.",
      contentAngle: "Title, bullets, and attributes for cleaner marketplace entity understanding",
      desiredContentType: "listing update",
      topicalKeywords: ["listing", "walmart", "attributes", "bullets"],
      draftTitle: `${productName} Walmart listing optimization draft`,
      draftBody:
        `Update title clarity, bullet consistency, and structured attributes for ${productName} while keeping compliance-safe wording.`,
      relevanceOffset: 12,
      citationOffset: 8,
      impactOffset: 15,
    },
    {
      type: "faq_gap",
      title: "Add product FAQ block to Walmart listing draft",
      destinationHint: "walmart",
      recommendedActionTemplate: "Add product FAQ block to Walmart listing draft.",
      fallbackAction: "Add product FAQ block to Walmart listing draft.",
      rationale:
        "Listing FAQ coverage improves answer quality for shopper intent and AI retrieval.",
      contentAngle: "Serving size, usage context, and product positioning questions",
      desiredContentType: "faq",
      topicalKeywords: ["faq", "questions", "usage", "serving"],
      draftTitle: `${productName} Walmart FAQ draft`,
      draftBody:
        `FAQ examples for ${productName}: Who is it for? How should it be used? What facts should shoppers compare before purchase?`,
      relevanceOffset: 10,
      citationOffset: 8,
      impactOffset: 12,
    },
    {
      type: "image_media",
      title: "Improve Walmart product image metadata",
      destinationHint: "walmart",
      recommendedActionTemplate: "Create image alt text and metadata updates for Walmart product images.",
      fallbackAction: "Create image alt text and metadata updates for Walmart product images.",
      rationale:
        "Image metadata supports multimodal retrieval and improves product understanding in AI systems.",
      contentAngle: `${productName} image alt text focused on factual product context`,
      desiredContentType: "image metadata",
      topicalKeywords: ["image", "metadata", "alt", "visual"],
      draftTitle: `${productName} image metadata draft`,
      draftBody:
        `Alt text suggestion: ${productName} product packaging with clear label and wellness support context.`,
      relevanceOffset: 7,
      citationOffset: 6,
      impactOffset: 10,
    },
    {
      type: "community",
      title: "Create topical Q&A article draft",
      destinationHint: "wordpress",
      recommendedActionTemplate: "Create WordPress Q&A support article draft on {destination}.",
      fallbackAction:
        "No strong matching connected property found for this topic yet. Create a manual Q&A draft and map a suitable destination.",
      rationale:
        "Trusted Q&A content can become a recurring source for product selection guidance.",
      contentAngle: `${productName} audience-fit and routine-usage Q&A`,
      desiredContentType: "educational article",
      topicalKeywords: ["q", "a", "audience", "routine", product.category],
      draftTitle: `${productName} Q&A article draft`,
      draftBody:
        `Create a non-promotional Q&A article for ${productName} with practical usage context and factual product references.`,
      relevanceOffset: 6,
      citationOffset: 10,
      impactOffset: 8,
    },
    {
      type: "competitor_gap",
      title: "Create competitor comparison draft",
      destinationHint: "wordpress",
      recommendedActionTemplate: "Create WordPress comparison post draft on {destination}.",
      fallbackAction:
        "No strong matching connected property found for this topic yet. Create a comparison draft for manual review and distribution.",
      rationale:
        "Comparison content can close trust and citation gaps against competing products.",
      contentAngle: `${productName} comparison checklist and decision factors`,
      desiredContentType: "comparison post",
      topicalKeywords: ["comparison", "best", "vs", "buying", product.category],
      draftTitle: `${productName} comparison draft`,
      draftBody:
        `Build a comparison framework for ${productName} with factual criteria and compliance-safe descriptors.`,
      relevanceOffset: 7,
      citationOffset: 8,
      impactOffset: 9,
    },
  ];
}

function productContextTokens(product: WalmartEffectiveProductRecord): string[] {
  return tokenize(
    [
      product.title,
      product.brand,
      product.category,
      product.shortDescription,
      product.longDescription,
      ...(product.bulletPoints ?? []),
    ]
      .filter((entry) => typeof entry === "string")
      .join(" ")
  );
}

function statusPenalty(status: WalmartNetworkConnection["status"]): number {
  if (status === "connected") return 0;
  if (status === "needs_attention") return 15;
  return 35;
}

export function scoreWordpressDestinationFit(input: {
  product: WalmartEffectiveProductRecord;
  template: {
    topicalKeywords: string[];
    desiredContentType: string;
    contentAngle: string;
  };
  connection: WalmartNetworkConnection;
}): DestinationFit {
  const connection = input.connection;
  const guardrails = connection.guardrails;
  const destinationName = hostFromUrl(connection.url) || connection.name;

  const productTokens = productContextTokens(input.product);
  const templateTokens = tokenize(`${input.template.contentAngle} ${input.template.topicalKeywords.join(" ")}`);
  const contextTokens = Array.from(new Set([...productTokens, ...templateTokens]));

  const primaryTokens = tokenize(guardrails?.primaryNiche ?? "");
  const secondaryTokens = tokenize((guardrails?.secondaryNiches ?? []).join(" "));
  const allowedTokens = tokenize((guardrails?.allowedTopics ?? []).join(" "));
  const blockedTokens = tokenize((guardrails?.blockedTopics ?? []).join(" "));
  const preferredTypeTokens = tokenize((guardrails?.preferredContentTypes ?? []).join(" "));
  const audienceTokens = tokenize(guardrails?.audience ?? "");

  const primaryOverlap = overlapCount(primaryTokens, contextTokens);
  const secondaryOverlap = overlapCount(secondaryTokens, contextTokens);
  const allowedOverlap = overlapCount(allowedTokens, contextTokens);
  const blockedOverlap = overlapCount(blockedTokens, contextTokens);
  const audienceOverlap = overlapCount(audienceTokens, contextTokens);
  const contentTypeOverlap = overlapCount(preferredTypeTokens, tokenize(input.template.desiredContentType));

  const score = clampScore(
    25 +
      primaryOverlap * 16 +
      Math.min(secondaryOverlap, 3) * 8 +
      Math.min(allowedOverlap, 4) * 6 +
      Math.min(audienceOverlap, 2) * 5 +
      Math.min(contentTypeOverlap, 2) * 8 -
      blockedOverlap * 22 -
      statusPenalty(connection.status)
  );

  const rationaleParts: string[] = [];
  if (guardrails?.primaryNiche) rationaleParts.push(`${destinationName} primary niche: ${guardrails.primaryNiche}.`);
  if (allowedOverlap > 0) rationaleParts.push("Allowed topics align with this opportunity.");
  if (contentTypeOverlap > 0) rationaleParts.push("Preferred content types match the recommended draft format.");
  if (blockedOverlap > 0) rationaleParts.push("Blocked topic overlap reduced fit.");
  if (connection.status === "needs_attention") rationaleParts.push("Connection needs attention before publish actions.");

  return {
    connectionId: connection.id,
    destinationName,
    destinationUrl: connection.url,
    platform: "wordpress",
    fitScore: score,
    rationale: rationaleParts.join(" ") || `${destinationName} has limited topical guardrail data.`,
    recommendedAction: `Create WordPress ${input.template.desiredContentType} draft on ${destinationName}`,
    contentAngle: input.template.contentAngle,
  };
}

function rankWordpressDestinations(input: {
  product: WalmartEffectiveProductRecord;
  template: OpportunityTemplate;
  connections: WalmartNetworkConnection[];
}): DestinationFit[] {
  return input.connections
    .filter((connection) => connection.platform === "wordpress")
    .map((connection) =>
      scoreWordpressDestinationFit({
        product: input.product,
        template: {
          topicalKeywords: input.template.topicalKeywords,
          desiredContentType: input.template.desiredContentType,
          contentAngle: input.template.contentAngle,
        },
        connection,
      })
    )
    .sort((left, right) => right.fitScore - left.fitScore);
}

function buildDestinationForTemplate(input: {
  product: WalmartEffectiveProductRecord;
  template: OpportunityTemplate;
  connections: WalmartNetworkConnection[];
  warningSuffix: string;
}): IBrainsOpportunityDestination {
  if (input.template.destinationHint === "walmart") {
    return {
      destinationName: "Walmart listing",
      destinationType: "marketplace_listing",
      platform: "walmart",
      recommendedAction: input.template.recommendedActionTemplate,
      contentAngle: input.template.contentAngle,
      whyThisDestination:
        `Walmart listing completeness improves marketplace discovery and gives AI systems cleaner product facts.${input.warningSuffix}`,
      fitScore: 100,
    };
  }

  if (input.template.destinationHint === "wordpress") {
    const ranked = rankWordpressDestinations({
      product: input.product,
      template: input.template,
      connections: input.connections,
    });
    const best = ranked.find((fit) => fit.fitScore >= DESTINATION_MATCH_THRESHOLD);

    if (best) {
      return {
        connectionId: best.connectionId,
        destinationName: best.destinationName,
        destinationUrl: best.destinationUrl,
        platform: "wordpress",
        destinationType: "wordpress_site",
        recommendedAction: input.template.recommendedActionTemplate.replace("{destination}", best.destinationName),
        contentAngle: best.contentAngle,
        whyThisDestination: `${best.rationale}${input.warningSuffix}`,
        fitScore: best.fitScore,
      };
    }

    return {
      destinationName: "No strong match yet",
      destinationType: "manual",
      platform: "other",
      recommendedAction: input.template.fallbackAction,
      contentAngle: input.template.contentAngle,
      whyThisDestination:
        `No strong matching connected property found for this topic yet. Use on Walmart listing, create a draft for manual use, or add a new WordPress property for this niche.${input.warningSuffix}`,
      fitScore: 0,
    };
  }

  return {
    destinationName: "Manual workflow",
    destinationType: "manual",
    platform: "other",
    recommendedAction: input.template.fallbackAction,
    contentAngle: input.template.contentAngle,
    whyThisDestination: `This opportunity currently requires approval-first manual routing.${input.warningSuffix}`,
    fitScore: 0,
  };
}

export function extractRiskyClaimsFromProduct(product: WalmartEffectiveProductRecord): string[] {
  const corpus = [product.title, product.shortDescription, product.longDescription, ...product.bulletPoints]
    .filter((entry) => typeof entry === "string")
    .join("\n");

  const hits = new Set<string>();
  for (const pattern of RISKY_CLAIM_PATTERNS) {
    const match = corpus.match(pattern);
    if (match?.[0]) hits.add(match[0].toLowerCase());
  }
  return Array.from(hits);
}

export function summarizeWalmartIBrainsOpportunities(
  opportunities: IBrainsIntelligenceOpportunity[]
): IBrainsIntelligenceRun["summary"] {
  const opportunitiesFound = opportunities.length;
  const highImpactActions = opportunities.filter((row) => row.agenticVisibilityScore >= 75).length;
  const complianceWarnings = opportunities.filter((row) => row.complianceRisk !== "low").length;
  const draftsReady = opportunities.filter(
    (row) =>
      Boolean(row.draftBody?.trim()) &&
      (row.status === "draft_ready" || row.status === "needs_approval" || row.status === "approved")
  ).length;

  const averageOpportunityScore = opportunitiesFound
    ? opportunities.reduce((sum, row) => sum + row.agenticVisibilityScore, 0) / opportunitiesFound
    : 0;

  const topDestinationMap = new Map<string, IBrainsIntelligenceRun["summary"]["topDestinations"][number]>();
  for (const opportunity of opportunities) {
    if (!opportunity.destination.connectionId || opportunity.destination.fitScore === undefined) continue;
    const key = opportunity.destination.connectionId;
    const current = topDestinationMap.get(key);
    if (!current || opportunity.destination.fitScore > current.fitScore) {
      topDestinationMap.set(key, {
        destinationName: opportunity.destination.destinationName,
        destinationUrl: opportunity.destination.destinationUrl,
        platform: opportunity.destination.platform,
        fitScore: opportunity.destination.fitScore,
      });
    }
  }

  const topDestinations = Array.from(topDestinationMap.values())
    .sort((left, right) => right.fitScore - left.fitScore)
    .slice(0, 3);

  return {
    agenticVisibilityScore: clampScore(averageOpportunityScore),
    opportunitiesFound,
    highImpactActions,
    complianceWarnings,
    draftsReady,
    strongDestinationMatches: topDestinations.length,
    topDestinations,
  };
}

export function runWalmartIBrainsIntelligence(
  product: WalmartEffectiveProductRecord,
  options?: {
    networkConnections?: WalmartNetworkConnection[];
  }
): IBrainsIntelligenceRun {
  const now = new Date().toISOString();
  const productRiskHits = extractRiskyClaimsFromProduct(product);
  const baseScore = inferBaseAgenticVisibilityScore(product);
  const connections = options?.networkConnections ?? [];

  const opportunities = buildOpportunityTemplates(product).map((template, index) => {
    const relevanceScore = clampScore(baseScore + template.relevanceOffset - index);
    const citationPotentialScore = clampScore(baseScore - 12 + template.citationOffset);

    const warningSuffix =
      productRiskHits.length > 0
        ? ` Compliance note: potential risky claim terms detected (${productRiskHits.join(", ")}). Keep support-focused language and route for review.`
        : "";

    const destination = buildDestinationForTemplate({
      product,
      template,
      connections,
      warningSuffix,
    });

    const agenticVisibilityScore = clampScore(
      relevanceScore * 0.38 +
        citationPotentialScore * 0.22 +
        (baseScore + template.impactOffset) * 0.3 +
        (destination.fitScore ?? 0) * 0.1
    );

    const complianceRisk = inferComplianceRisk({
      productRiskHits,
      type: template.type,
    });

    const hasDraft = Boolean(template.draftBody.trim());
    const status = defaultStatusForOpportunity({ complianceRisk, hasDraft });

    return {
      id: `ibrains-${normalizeSkuKey(product.sku).toLowerCase()}-${template.type}-${index + 1}`,
      productId: product.id,
      productName: product.title,
      sku: product.sku,
      marketplace: "walmart",
      type: template.type,
      title: template.title,
      sourceName: destination.destinationName,
      sourceDomain: destination.destinationUrl ? hostFromUrl(destination.destinationUrl) : destination.destinationName,
      url: destination.destinationUrl,
      snippet: `${product.title} | SKU: ${product.sku}`,
      relevanceScore,
      citationPotentialScore,
      agenticVisibilityScore,
      complianceRisk,
      recommendedAction: destination.recommendedAction,
      rationale: `${template.rationale} ${destination.whyThisDestination}`.trim(),
      draftTitle: template.draftTitle,
      draftBody: template.draftBody,
      status,
      createdAt: now,
      destination,
    } satisfies IBrainsIntelligenceOpportunity;
  });

  opportunities.sort((left, right) => right.agenticVisibilityScore - left.agenticVisibilityScore);

  return {
    id: `ibrains-run-${normalizeSkuKey(product.sku).toLowerCase()}-${Date.now()}`,
    productId: product.id,
    productName: product.title,
    sku: product.sku,
    marketplace: "walmart",
    status: "completed",
    startedAt: now,
    completedAt: now,
    queries: [
      `${product.title} walmart listing optimization`,
      `${product.title} buyer guide`,
      `${product.brand} ${product.sku} trusted references`,
      `${product.title} citation-ready draft destinations`,
    ],
    opportunities,
    summary: summarizeWalmartIBrainsOpportunities(opportunities),
  };
}
