export type Pillar = "structure" | "clarity" | "trust" | "authority" | "actionability";

export type RiskTier = "low" | "medium" | "high";

export type VerticalConfig = {
  key: string;
  label: string;
  riskTier: RiskTier;
  weights: Record<Pillar, number>;
  attributeExpectations: string[];
};

export type BlogType = "comparison" | "best-of" | "contextual-guide" | "persona-guide";
export type BlogStatus = "Not Created" | "Draft" | "Published";

export type BlogPost = {
  id: string;
  type: BlogType;
  title: string;
  focusTopic: string;
  status: BlogStatus;
  body: string;
  featuredImagePrompt?: string;
  featuredImageUrl?: string;
  blogToListingLinked: boolean;
  listingToBlogLinked: boolean;
};

export type Listing = {
  id: string;
  name: string;
  verticalHint: string;
  title: string;
  description: string;
  category: string;
  location: string;
  contact: string;
  serviceArea: string;
  taxonomyAligned: boolean;
  locationIntegrity: boolean;
  sectionFormatting: number;
  structuredFields: number;
  specificity: number;
  scopeDefinition: number;
  differentiators: number;
  machineReadableSignals: number;
  genericLanguage: number;
  ambiguitySeverity: "none" | "light" | "moderate" | "severe";
  reviews: number;
  credentials: number;
  evidenceSignals: number;
  identityConsistency: number;
  riskInverse: number;
  ctaVisibility: number;
  bookingFunctionality: number;
  conversionFrictionInverse: number;
  commercialAlignment: number;
  responsePathClarity: number;
  relatedGuides: { title: string; url: string }[];
  posts: BlogPost[];
  lastOptimized: string;
};

export type ScoreResult = {
  pillars: Record<Pillar, number>;
  total: number;
  capIndicators: {
    structuralGate: string;
    clarityCeiling: string;
    trustRiskCap: string;
    authorityCeiling: string;
    ambiguityPenalty: string;
  };
  authorityStatus: string;
  trustStatus: string;
  scoreDeltaHint: string[];
};

export const verticalConfigs: VerticalConfig[] = [
  {
    key: "legal-services",
    label: "Legal Services",
    riskTier: "high",
    weights: { structure: 0.22, clarity: 0.2, trust: 0.28, authority: 0.15, actionability: 0.15 },
    attributeExpectations: ["practice areas", "jurisdiction", "case-type scope", "consult process"],
  },
  {
    key: "home-services",
    label: "Home Services",
    riskTier: "medium",
    weights: { structure: 0.23, clarity: 0.2, trust: 0.22, authority: 0.15, actionability: 0.2 },
    attributeExpectations: ["service radius", "job categories", "response windows", "pricing approach"],
  },
  {
    key: "wellness",
    label: "Wellness",
    riskTier: "high",
    weights: { structure: 0.22, clarity: 0.2, trust: 0.3, authority: 0.13, actionability: 0.15 },
    attributeExpectations: ["services", "certification scope", "contraindications", "session format"],
  },
];

export const progressMessages = [
  "Scanning listings…",
  "Mapping structure…",
  "Evaluating selection signals…",
  "Identifying authority gaps…",
  "Detecting monetization/actionability opportunities…",
];

const riskMultiplier: Record<RiskTier, number> = { low: 1, medium: 1.15, high: 1.3 };

const avg = (...vals: number[]) => Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function detectVertical(listing: Listing): VerticalConfig {
  const lowered = `${listing.verticalHint} ${listing.category}`.toLowerCase();
  if (lowered.includes("attorney") || lowered.includes("law")) return verticalConfigs[0];
  if (lowered.includes("plumb") || lowered.includes("hvac") || lowered.includes("roof")) return verticalConfigs[1];
  return verticalConfigs[2];
}

export function computeScore(listing: Listing, vertical: VerticalConfig): ScoreResult {
  const requiredFieldsPresent = [listing.title, listing.description, listing.category, listing.contact].every(
    (v) => v.trim().length > 0
  );

  const structure = avg(
    requiredFieldsPresent ? 100 : 20,
    listing.taxonomyAligned ? 90 : 40,
    listing.locationIntegrity ? 90 : 45,
    listing.sectionFormatting,
    listing.structuredFields
  );

  const clarityRaw = avg(
    listing.specificity,
    listing.scopeDefinition,
    listing.differentiators,
    listing.machineReadableSignals,
    100 - listing.genericLanguage
  );

  const ambiguityPenalty =
    listing.ambiguitySeverity === "light"
      ? 5
      : listing.ambiguitySeverity === "moderate"
      ? 10
      : listing.ambiguitySeverity === "severe"
      ? 18
      : 0;
  const clarity = clamp(clarityRaw - ambiguityPenalty);

  const trust = avg(
    listing.reviews,
    listing.credentials,
    listing.evidenceSignals,
    listing.identityConsistency,
    listing.riskInverse
  );

  const validPosts = listing.posts.slice(0, 4);
  const strongPosts = validPosts.filter((p) => p.status === "Published").length;
  const hasBrokenLink = validPosts.some((p) => !p.blogToListingLinked || !p.listingToBlogLinked);
  const authorityBase = avg(
    Math.min(100, strongPosts * 22 + 10),
    hasBrokenLink ? 40 : 90,
    Math.min(100, listing.relatedGuides.length * 20 + 20),
    65,
    listing.relatedGuides.length > 0 ? 85 : 30
  );
  const authority = hasBrokenLink ? Math.min(authorityBase, 50) : authorityBase;

  const actionability = avg(
    listing.ctaVisibility,
    listing.bookingFunctionality,
    listing.conversionFrictionInverse,
    listing.commercialAlignment,
    listing.responsePathClarity
  );

  const weighted =
    structure * vertical.weights.structure +
    clarity * vertical.weights.clarity +
    trust * vertical.weights.trust * riskMultiplier[vertical.riskTier] +
    authority * vertical.weights.authority +
    actionability * vertical.weights.actionability;

  let total = clamp(weighted);
  const notes: string[] = [];
  let structuralGate = "No gate active";
  if (!requiredFieldsPresent) {
    total = Math.min(total, 45);
    structuralGate = "Hard fail gate active (missing required listing fields)";
    notes.push("Structure hard fail ceiling enforced at 45");
  } else if (structure < 30) {
    total = Math.min(total, 50);
    structuralGate = "Structure <30 cap active at 50";
  } else if (structure < 50) {
    total = Math.min(total, 65);
    structuralGate = "Structure 30-49 cap active at 65";
  } else if (structure < 70) {
    total = Math.min(total, 80);
    structuralGate = "Structure 50-69 cap active at 80";
  }

  let clarityCeiling = "No clarity cap active";
  if (clarity < 25) {
    total = Math.min(total, 60);
    clarityCeiling = "Clarity <25 cap active at 60";
  } else if (clarity < 40) {
    total = Math.min(total, 70);
    clarityCeiling = "Clarity <40 cap active at 70";
  }

  let trustRiskCap = "No trust risk cap active";
  if (vertical.riskTier === "high" && trust < 35) {
    total = Math.min(total, 60);
    trustRiskCap = "High-risk vertical with Trust <35 cap at 60";
  } else if (vertical.riskTier === "high" && trust < 50) {
    total = Math.min(total, 70);
    trustRiskCap = "High-risk vertical with Trust <50 cap at 70";
  }

  let authorityCeiling = "No authority ceiling active";
  if (authority < 30) {
    total = Math.min(total, 65);
    authorityCeiling = "Authority <30 cap at 65";
  } else if (authority < 50) {
    total = Math.min(total, 75);
    authorityCeiling = "Authority 30-49 cap at 75";
  } else if (authority < 75) {
    total = Math.min(total, 85);
    authorityCeiling = "Authority 50-74 cap at 85";
  }

  return {
    pillars: { structure, clarity, trust, authority, actionability },
    total,
    capIndicators: {
      structuralGate,
      clarityCeiling,
      trustRiskCap,
      authorityCeiling,
      ambiguityPenalty: ambiguityPenalty === 0 ? "No ambiguity penalty" : `Ambiguity penalty −${ambiguityPenalty}`,
    },
    authorityStatus: hasBrokenLink ? "Link Integrity Missing" : strongPosts > 1 ? "Supported" : "Needs Support",
    trustStatus: trust >= 70 ? "Strong" : trust >= 50 ? "Moderate" : "At Risk",
    scoreDeltaHint: notes,
  };
}

export function buildDraft(post: BlogPost, listing: Listing): string {
  const listingUrl = `/listing/${listing.id}`;
  const anchor = listing.name;
  const intro = `This guide evaluates ${post.focusTopic} using verified directory details and practical decision criteria.`;
  const linkLine = `If you need direct details, review <a href="${listingUrl}">${anchor}</a> for verified listing information.`;
  const body = [
    intro,
    "Selection Criteria",
    "- Scope match for your exact need",
    "- Credential fit and evidence clarity",
    "- Response path transparency",
    linkLine,
    "Decision Notes",
    "Use this content as a decision framework, not a universal ranking.",
  ];
  return body.join("\n\n");
}

export function hasContextualListingLink(body: string, listingId: string): boolean {
  const normalized = body.toLowerCase();
  return normalized.includes(`/listing/${listingId}`) && !normalized.includes(">click here<");
}
