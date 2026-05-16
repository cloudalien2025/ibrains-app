import type { WalmartEffectiveProductRecord } from "@/lib/ecomviper/walmart/walmart-product-display";

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
  };
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

export function extractRiskyClaimsFromProduct(product: WalmartEffectiveProductRecord): string[] {
  const corpus = [
    product.title,
    product.shortDescription,
    product.longDescription,
    ...product.bulletPoints,
  ]
    .filter((entry) => typeof entry === "string")
    .join("\n");

  const hits = new Set<string>();
  for (const pattern of RISKY_CLAIM_PATTERNS) {
    const match = corpus.match(pattern);
    if (match?.[0]) hits.add(match[0].toLowerCase());
  }
  return Array.from(hits);
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

function classifySourceForType(type: IBrainsOpportunityType): {
  sourceName: string;
  sourceDomain: string;
  url: string;
} {
  if (type === "citation") {
    return {
      sourceName: "Knowledge and buying guides",
      sourceDomain: "wellness-resource-hubs.example",
      url: "https://wellness-resource-hubs.example",
    };
  }
  if (type === "community") {
    return {
      sourceName: "Community Q&A channels",
      sourceDomain: "qa-community.example",
      url: "https://qa-community.example",
    };
  }
  if (type === "marketplace") {
    return {
      sourceName: "Walmart PDP and listing fields",
      sourceDomain: "walmart.com",
      url: "https://www.walmart.com",
    };
  }
  if (type === "owned_content") {
    return {
      sourceName: "Owned brand content",
      sourceDomain: "yourbrand.example",
      url: "https://yourbrand.example",
    };
  }
  if (type === "image_media") {
    return {
      sourceName: "Image metadata channels",
      sourceDomain: "cdn-content.example",
      url: "https://cdn-content.example",
    };
  }
  if (type === "backlink_outreach") {
    return {
      sourceName: "Partner and editorial outreach",
      sourceDomain: "editorial-outreach.example",
      url: "https://editorial-outreach.example",
    };
  }
  if (type === "competitor_gap") {
    return {
      sourceName: "Competitor citation gaps",
      sourceDomain: "market-intelligence.example",
      url: "https://market-intelligence.example",
    };
  }
  return {
    sourceName: "FAQ coverage surfaces",
    sourceDomain: "support-content.example",
    url: "https://support-content.example",
  };
}

function buildOpportunityTemplates(product: WalmartEffectiveProductRecord): Array<{
  type: IBrainsOpportunityType;
  title: string;
  recommendedAction: string;
  rationale: string;
  draftTitle: string;
  draftBody: string;
  relevanceOffset: number;
  citationOffset: number;
  impactOffset: number;
}> {
  const productName = product.title || product.sku;
  const safeBlurb = `${productName} is designed to support daily wellness and should be reviewed for marketplace-safe claims before publication.`;

  return [
    {
      type: "citation",
      title: "Create citation-ready product fact snippet",
      recommendedAction:
        "Draft a concise product fact block with SKU, use context, and compliant wellness language for citation-friendly placements.",
      rationale:
        "Citation surfaces improve how AI agents and recommendation systems verify product facts before recommending or selecting a listing.",
      draftTitle: `${productName} citation-ready facts`,
      draftBody: `${safeBlurb}\n\nSuggested citation snippet:\n${productName} | SKU: ${product.sku} | Supports daily wellness routines with clear usage and ingredient context.`,
      relevanceOffset: 8,
      citationOffset: 14,
      impactOffset: 10,
    },
    {
      type: "community",
      title: "Prepare high-trust community Q&A response draft",
      recommendedAction:
        "Prepare a helpful, non-promotional Q&A response explaining who the product is for and how it supports general wellness routines.",
      rationale:
        "Community answers can become recurring references for AI systems when they are factual, helpful, and safely phrased.",
      draftTitle: `${productName} community answer draft`,
      draftBody:
        `Thanks for asking about ${productName}. It is designed to support general wellness goals as part of a balanced routine. ` +
        "For transparency, include ingredient context, serving guidance, and a link to the Walmart listing so shoppers can review details.",
      relevanceOffset: 7,
      citationOffset: 10,
      impactOffset: 11,
    },
    {
      type: "marketplace",
      title: "Strengthen Walmart listing selection signals",
      recommendedAction:
        "Improve title clarity, structured attributes, and bullet consistency so AI-driven shopping flows can parse and rank the listing confidently.",
      rationale:
        "Marketplace completeness directly affects discoverability, recommendation quality, and selection confidence.",
      draftTitle: `${productName} Walmart listing improvement plan`,
      draftBody:
        `Update the Walmart listing for ${productName} with clearer value context, complete attributes, and shopper-friendly bullets that use support-focused language.`,
      relevanceOffset: 12,
      citationOffset: 8,
      impactOffset: 15,
    },
    {
      type: "owned_content",
      title: "Draft owned content angle for agentic discovery",
      recommendedAction:
        "Create an owned article or guide section that explains product usage context and links back to Walmart with citation-ready facts.",
      rationale:
        "Owned content helps search engines and assistants map your product to trustworthy topical entities.",
      draftTitle: `${productName} daily wellness guide angle`,
      draftBody:
        `Article angle: How ${productName} fits into a consistent daily wellness routine. Include practical usage tips, ingredient transparency, and a Walmart purchase reference.`,
      relevanceOffset: 6,
      citationOffset: 9,
      impactOffset: 9,
    },
    {
      type: "image_media",
      title: "Improve image metadata for AI understanding",
      recommendedAction:
        "Add descriptive alt text and SEO-safe file names so visual search and multimodal agents can understand product context.",
      rationale:
        "Image metadata increases comprehension in visual discovery channels and recommendation engines.",
      draftTitle: `${productName} image metadata draft`,
      draftBody:
        `Alt text suggestion: ${productName} wellness support product packaging on clean background.\nFilename suggestion: ${normalizeSkuKey(product.sku).toLowerCase()}-wellness-support-walmart.jpg`,
      relevanceOffset: 9,
      citationOffset: 6,
      impactOffset: 11,
    },
    {
      type: "backlink_outreach",
      title: "Prepare partner outreach brief for trusted mentions",
      recommendedAction:
        "Draft outreach copy for relevant publishers or partners focused on factual product references and safe, support-oriented language.",
      rationale:
        "Trusted mentions can improve the probability that assistants and recommendation layers surface your product.",
      draftTitle: `${productName} outreach draft`,
      draftBody:
        `Hello team, we are sharing updated reference details for ${productName} (SKU: ${product.sku}). ` +
        "If relevant for your audience, you can cite its daily wellness support positioning and ingredient transparency.",
      relevanceOffset: 5,
      citationOffset: 11,
      impactOffset: 8,
    },
    {
      type: "competitor_gap",
      title: "Close competitor citation and content gaps",
      recommendedAction:
        "Identify missing trust signals or FAQs competitors have and draft improved, compliant versions for your listing ecosystem.",
      rationale:
        "Competitive gap closure increases selection probability in ranking and recommendation flows.",
      draftTitle: `${productName} competitor gap checklist`,
      draftBody:
        `Gap checklist for ${productName}: citation-ready summary, complete attribute coverage, FAQ depth, and clearer media metadata for agentic visibility.`,
      relevanceOffset: 8,
      citationOffset: 7,
      impactOffset: 10,
    },
    {
      type: "faq_gap",
      title: "Generate FAQ recommendations for selection clarity",
      recommendedAction:
        "Draft FAQ responses covering usage context, audience fit, and ingredient transparency in support-focused language.",
      rationale:
        "FAQ completeness helps assistants answer intent-specific questions and recommend the right product.",
      draftTitle: `${productName} FAQ recommendation draft`,
      draftBody:
        `FAQ recommendation:\nQ: Who is ${productName} designed for?\nA: It is designed to support daily wellness routines for adults seeking consistent nutritional support.`,
      relevanceOffset: 10,
      citationOffset: 8,
      impactOffset: 12,
    },
  ];
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

  const agenticVisibilityScore = clampScore(averageOpportunityScore);

  return {
    agenticVisibilityScore,
    opportunitiesFound,
    highImpactActions,
    complianceWarnings,
    draftsReady,
  };
}

export function runWalmartIBrainsIntelligence(
  product: WalmartEffectiveProductRecord
): IBrainsIntelligenceRun {
  const now = new Date().toISOString();
  const productRiskHits = extractRiskyClaimsFromProduct(product);
  const baseScore = inferBaseAgenticVisibilityScore(product);

  const opportunities = buildOpportunityTemplates(product).map((template, index) => {
    const relevanceScore = clampScore(baseScore + template.relevanceOffset - index);
    const citationPotentialScore = clampScore(baseScore - 12 + template.citationOffset);
    const agenticVisibilityScore = clampScore(
      relevanceScore * 0.4 + citationPotentialScore * 0.25 + (baseScore + template.impactOffset) * 0.35
    );

    const complianceRisk = inferComplianceRisk({
      productRiskHits,
      type: template.type,
    });

    const hasDraft = Boolean(template.draftBody.trim());
    const status = defaultStatusForOpportunity({ complianceRisk, hasDraft });

    const source = classifySourceForType(template.type);
    const warningSuffix =
      productRiskHits.length > 0
        ? ` Compliance note: potential risky claim terms detected (${productRiskHits.join(", ")}). Keep support-focused language and route for review.`
        : "";

    return {
      id: `ibrains-${normalizeSkuKey(product.sku).toLowerCase()}-${template.type}-${index + 1}`,
      productId: product.id,
      productName: product.title,
      sku: product.sku,
      marketplace: "walmart",
      type: template.type,
      title: template.title,
      sourceName: source.sourceName,
      sourceDomain: source.sourceDomain,
      url: source.url,
      snippet: `${product.title} | SKU: ${product.sku}`,
      relevanceScore,
      citationPotentialScore,
      agenticVisibilityScore,
      complianceRisk,
      recommendedAction: template.recommendedAction,
      rationale: `${template.rationale}${warningSuffix}`,
      draftTitle: template.draftTitle,
      draftBody: template.draftBody,
      status,
      createdAt: now,
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
      `${product.title} walmart review insights`,
      `${product.title} wellness faq`,
      `${product.brand} ${product.sku} product references`,
      `${product.title} citation opportunity`,
    ],
    opportunities,
    summary: summarizeWalmartIBrainsOpportunities(opportunities),
  };
}
