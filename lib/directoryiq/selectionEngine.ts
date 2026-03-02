export type DirectoryIqVerticalId =
  | "home-services"
  | "health-medical"
  | "legal-financial"
  | "hospitality-travel"
  | "education"
  | "general";

export type RiskTier = "low" | "medium" | "high";

export type PostType = "comparison" | "best_of" | "contextual_guide" | "persona_intent";

export type AuthorityPostInput = {
  slot: number;
  type: PostType;
  status: "not_created" | "draft" | "published";
  focusTopic: string;
  title: string;
  qualityScore: number;
  blogToListingLinked: boolean;
  listingToBlogLinked: boolean;
};

export type ListingSelectionInput = {
  listingId: string;
  title: string;
  description: string;
  category: string;
  location: string;
  contact: string;
  ctaText: string;
  schemaSignals: string[];
  taxonomySignals: string[];
  credentialsSignals: string[];
  reviewCount: number;
  averageRating: number | null;
  evidenceSignals: string[];
  identitySignals: string[];
  internalMentionsCount: number;
  clusterDensity: number;
  orphanRisk: number;
  vertical: DirectoryIqVerticalId;
  riskTierOverride?: RiskTier | null;
  authorityPosts: AuthorityPostInput[];
};

export type PillarScores = {
  structure: number;
  clarity: number;
  trust: number;
  authority: number;
  actionability: number;
};

export type ActiveCap = {
  kind:
    | "structure_gate"
    | "structure_hard_fail"
    | "clarity_cap"
    | "trust_risk_cap"
    | "authority_ceiling";
  cap: number;
  reason: string;
};

export type EvaluationFlags = {
  structuralGateActive: boolean;
  structuralHardFailActive: boolean;
  authorityCeilingActive: boolean;
  ambiguityPenaltyApplied: boolean;
  trustRiskCapActive: boolean;
};

export type ListingSelectionEvaluation = {
  listingId: string;
  vertical: DirectoryIqVerticalId;
  riskTier: RiskTier;
  scores: PillarScores;
  weightedRawScore: number;
  ambiguityPenalty: number;
  totalScore: number;
  caps: ActiveCap[];
  flags: EvaluationFlags;
  authority: {
    consideredPosts: number;
    bidirectionalReadyCount: number;
    maxPostsEnforced: boolean;
  };
  gapsByPillar: Record<keyof PillarScores, string[]>;
};

type VerticalConfig = {
  riskTier: RiskTier;
  weights: PillarScores;
  specificityHints: string[];
};

const VERTICAL_CONFIG: Record<DirectoryIqVerticalId, VerticalConfig> = {
  "home-services": {
    riskTier: "medium",
    weights: { structure: 0.22, clarity: 0.22, trust: 0.22, authority: 0.16, actionability: 0.18 },
    specificityHints: ["service area", "service type", "availability", "response time"],
  },
  "health-medical": {
    riskTier: "high",
    weights: { structure: 0.2, clarity: 0.2, trust: 0.28, authority: 0.14, actionability: 0.18 },
    specificityHints: ["license", "scope of care", "location", "appointment process"],
  },
  "legal-financial": {
    riskTier: "high",
    weights: { structure: 0.2, clarity: 0.2, trust: 0.3, authority: 0.14, actionability: 0.16 },
    specificityHints: ["practice area", "jurisdiction", "fee model", "consultation path"],
  },
  "hospitality-travel": {
    riskTier: "medium",
    weights: { structure: 0.2, clarity: 0.23, trust: 0.2, authority: 0.2, actionability: 0.17 },
    specificityHints: ["amenities", "location context", "availability", "booking path"],
  },
  education: {
    riskTier: "medium",
    weights: { structure: 0.22, clarity: 0.22, trust: 0.22, authority: 0.16, actionability: 0.18 },
    specificityHints: ["program", "audience", "duration", "enrollment"],
  },
  general: {
    riskTier: "low",
    weights: { structure: 0.22, clarity: 0.24, trust: 0.18, authority: 0.18, actionability: 0.18 },
    specificityHints: ["service scope", "location", "contact path", "next step"],
  },
};

const SUPERLATIVE_PATTERN = /\b(best|top|leading|number\s*1|#1|world[- ]class|unmatched|ultimate|perfect)\b/gi;
const UNQUANTIFIED_PATTERN = /\b(very|highly|extremely|many|numerous|countless|fast|quick)\b/gi;
const BOILERPLATE_PATTERN = /\b(we are committed to|customer satisfaction is our priority|quality service every time)\b/gi;
const CLICK_HERE_PATTERN = /\bclick here\b/gi;

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, n));
}

function round(n: number): number {
  return Math.round(n);
}

export function detectVerticalFromSignals(category: string, taxonomySignals: string[]): DirectoryIqVerticalId {
  const corpus = `${category} ${(taxonomySignals ?? []).join(" ")}`.toLowerCase();

  if (/dentist|doctor|clinic|medical|health|therapy|chiropractic/.test(corpus)) return "health-medical";
  if (/law|attorney|legal|accounting|tax|financial|insurance/.test(corpus)) return "legal-financial";
  if (/hotel|travel|tour|restaurant|hospitality|vacation|lodging/.test(corpus)) return "hospitality-travel";
  if (/school|academy|education|course|training|tutor/.test(corpus)) return "education";
  if (/plumb|electri|hvac|roof|contractor|cleaning|repair|landscap/.test(corpus)) return "home-services";

  return "general";
}

function resolveRiskTier(vertical: DirectoryIqVerticalId, override?: RiskTier | null): RiskTier {
  return override ?? VERTICAL_CONFIG[vertical].riskTier;
}

function evaluateStructure(input: ListingSelectionInput): { score: number; hardFail: boolean } {
  const hasTitle = input.title.trim().length > 0;
  const hasDescription = input.description.trim().length >= 80;
  const hasCategory = input.category.trim().length > 0;
  const hasLocation = input.location.trim().length > 0;
  const hasContact = input.contact.trim().length > 0;
  const hasSchema = input.schemaSignals.length > 0;

  const requiredCount = [hasTitle, hasDescription, hasCategory, hasLocation, hasContact].filter(Boolean).length;
  const taxonomyAlignment = clamp(input.taxonomySignals.length * 15, 0, 20);
  const locationIntegrity = hasLocation ? 15 : 0;
  const sectionFormatting = clamp(Math.min(20, Math.floor(input.description.split(/\n\n+/).length * 6)), 0, 20);
  const structuredPresence = hasSchema ? 15 : 0;

  const requiredScore = requiredCount * 6;
  const score = clamp(requiredScore + taxonomyAlignment + locationIntegrity + sectionFormatting + structuredPresence, 0, 100);

  const hardFail = !hasDescription || !hasCategory || !hasContact || !hasSchema;
  return { score, hardFail };
}

function evaluateClarity(input: ListingSelectionInput): { score: number; ambiguityPenalty: number; severity: "none" | "light" | "moderate" | "severe" } {
  const specificityHints = VERTICAL_CONFIG[input.vertical].specificityHints;
  const corpus = `${input.title} ${input.description}`.toLowerCase();
  const specificityMatches = specificityHints.filter((hint) => corpus.includes(hint)).length;
  const hasNumbers = (input.description.match(/\b\d+(?:\.\d+)?\b/g) ?? []).length;
  const differentiators = (input.description.match(/\b(unlike|specialize|focus on|tailored|custom)\b/gi) ?? []).length;
  const machineSignals = input.schemaSignals.length + input.taxonomySignals.length;

  const genericHits = (input.description.match(/\b(great service|quality solutions|trusted partner|professional team)\b/gi) ?? []).length;

  let score = 20;
  score += specificityMatches * 12;
  score += Math.min(15, hasNumbers * 2);
  score += Math.min(20, differentiators * 6);
  score += Math.min(20, machineSignals * 3);
  score -= Math.min(20, genericHits * 5);
  score = clamp(score);

  const superlatives = (input.description.match(SUPERLATIVE_PATTERN) ?? []).length;
  const unquantified = (input.description.match(UNQUANTIFIED_PATTERN) ?? []).length;
  const boilerplate = (input.description.match(BOILERPLATE_PATTERN) ?? []).length;
  const contradictions = /\b(always open 24\/7).*(closed|limited hours)\b/i.test(input.description) ? 1 : 0;

  const severityScore = superlatives + unquantified + boilerplate + contradictions * 2;
  let ambiguityPenalty = 0;
  let severity: "none" | "light" | "moderate" | "severe" = "none";

  if (severityScore >= 8) {
    ambiguityPenalty = Math.min(20, 15 + contradictions * 5);
    severity = "severe";
  } else if (severityScore >= 5) {
    ambiguityPenalty = 10;
    severity = "moderate";
  } else if (severityScore >= 2) {
    ambiguityPenalty = 5;
    severity = "light";
  }

  return { score, ambiguityPenalty, severity };
}

function evaluateTrust(input: ListingSelectionInput): number {
  const reviewsScore = clamp(input.reviewCount >= 50 ? 25 : input.reviewCount / 2, 0, 25);
  const ratingScore = input.averageRating == null ? 8 : clamp((input.averageRating / 5) * 20, 0, 20);
  const credentialsScore = clamp(input.credentialsSignals.length * 10, 0, 20);
  const evidenceScore = clamp(input.evidenceSignals.length * 8, 0, 20);
  const identityScore = clamp(input.identitySignals.length * 5, 0, 15);

  return clamp(reviewsScore + ratingScore + credentialsScore + evidenceScore + identityScore);
}

function evaluateAuthority(input: ListingSelectionInput): { score: number; bidirectionalReadyCount: number; consideredPosts: number; maxPostsEnforced: boolean } {
  const posts = [...input.authorityPosts].sort((a, b) => a.slot - b.slot);
  const considered = posts.slice(0, 4);
  const maxPostsEnforced = posts.length > 4;

  const published = considered.filter((p) => p.status === "published");
  const draft = considered.filter((p) => p.status === "draft");
  const bidirectionalReady = considered.filter((p) => p.blogToListingLinked && p.listingToBlogLinked);

  const postStrength = considered.reduce((acc, post) => {
    const statusScore = post.status === "published" ? 18 : post.status === "draft" ? 10 : 0;
    const linkScore = post.blogToListingLinked && post.listingToBlogLinked ? 8 : post.blogToListingLinked || post.listingToBlogLinked ? 3 : 0;
    const quality = clamp(post.qualityScore, 0, 100) * 0.12;
    return acc + statusScore + linkScore + quality;
  }, 0);

  const clusterDensityScore = clamp(input.clusterDensity * 20, 0, 15);
  const mentionsScore = clamp(input.internalMentionsCount * 2, 0, 15);
  const orphanInverseScore = clamp((1 - input.orphanRisk) * 10, 0, 10);

  let score = clamp(postStrength + clusterDensityScore + mentionsScore + orphanInverseScore, 0, 100);

  if (considered.length === 0) {
    score = Math.min(score, 20);
  }

  if (published.length === 0 && draft.length > 0) {
    score = Math.min(score, 55);
  }

  return {
    score,
    bidirectionalReadyCount: bidirectionalReady.length,
    consideredPosts: considered.length,
    maxPostsEnforced,
  };
}

function evaluateActionability(input: ListingSelectionInput): number {
  const ctaVisible = input.ctaText.trim().length > 0 ? 30 : 10;
  const contactPath = input.contact.trim().length > 0 ? 25 : 0;
  const conversionFrictionInverse = clamp(25 - (CLICK_HERE_PATTERN.test(input.description) ? 8 : 0), 0, 25);
  const commercialAlignment = /book|reserve|call|quote|appointment|contact/i.test(input.ctaText + " " + input.description) ? 12 : 5;
  const responsePath = /within|response|next step|what happens/i.test(input.description) ? 8 : 2;
  return clamp(ctaVisible + contactPath + conversionFrictionInverse + commercialAlignment + responsePath);
}

function trustMultiplierForTier(tier: RiskTier): number {
  if (tier === "high") return 1.3;
  if (tier === "medium") return 1.15;
  return 1.0;
}

function gaps(input: ListingSelectionInput, scores: PillarScores, authorityMeta: { bidirectionalReadyCount: number }): Record<keyof PillarScores, string[]> {
  const out: Record<keyof PillarScores, string[]> = {
    structure: [], clarity: [], trust: [], authority: [], actionability: [],
  };

  if (input.description.trim().length < 120) out.structure.push("Expand listing description with concrete service details and scope.");
  if (!input.category.trim()) out.structure.push("Assign a primary category aligned with taxonomy.");
  if (!input.location.trim()) out.structure.push("Add explicit location/service-area details.");
  if (!input.contact.trim()) out.structure.push("Add visible contact method (phone/email/form).");
  if (input.schemaSignals.length === 0) out.structure.push("Add schema-mapped structured fields for machine readability.");

  if (scores.clarity < 70) out.clarity.push("Replace generic claims with quantified specifics and constraints.");
  if (SUPERLATIVE_PATTERN.test(input.description)) out.clarity.push("Remove superlative claims unless verifiable.");
  if (UNQUANTIFIED_PATTERN.test(input.description)) out.clarity.push("Convert vague language into measurable details.");

  if (scores.trust < 70) out.trust.push("Add verifiable credentials, evidence, and consistency signals.");
  if (input.reviewCount < 10) out.trust.push("Strengthen review evidence and ensure rating consistency.");

  if (authorityMeta.bidirectionalReadyCount === 0) out.authority.push("Create authority support posts with bidirectional linking.");
  if (input.authorityPosts.length < 4) out.authority.push("Use up to 4 authority post slots for topic cluster coverage.");

  if (!input.ctaText.trim()) out.actionability.push("Add explicit CTA with clear action and expected next step.");
  if (!/book|call|quote|contact|reserve/i.test(input.description + " " + input.ctaText)) {
    out.actionability.push("Clarify response path after contact/booking action.");
  }

  return out;
}

export function evaluateListingSelection(input: ListingSelectionInput): ListingSelectionEvaluation {
  const structureEval = evaluateStructure(input);
  const clarityEval = evaluateClarity(input);
  const trustScore = evaluateTrust(input);
  const authorityEval = evaluateAuthority(input);
  const actionabilityScore = evaluateActionability(input);

  const scores: PillarScores = {
    structure: structureEval.score,
    clarity: clarityEval.score,
    trust: trustScore,
    authority: authorityEval.score,
    actionability: actionabilityScore,
  };

  const vertical = input.vertical;
  const riskTier = resolveRiskTier(vertical, input.riskTierOverride ?? null);
  const config = VERTICAL_CONFIG[vertical];
  const trustWeightMultiplier = trustMultiplierForTier(riskTier);

  const effectiveWeights = {
    structure: config.weights.structure,
    clarity: config.weights.clarity,
    trust: config.weights.trust * trustWeightMultiplier,
    authority: config.weights.authority,
    actionability: config.weights.actionability,
  };

  const weightSum =
    effectiveWeights.structure +
    effectiveWeights.clarity +
    effectiveWeights.trust +
    effectiveWeights.authority +
    effectiveWeights.actionability;

  const weightedRaw =
    (scores.structure * effectiveWeights.structure +
      scores.clarity * effectiveWeights.clarity +
      scores.trust * effectiveWeights.trust +
      scores.authority * effectiveWeights.authority +
      scores.actionability * effectiveWeights.actionability) /
    weightSum;

  const caps: ActiveCap[] = [];

  if (structureEval.hardFail) {
    caps.push({
      kind: "structure_hard_fail",
      cap: 45,
      reason: "Missing required structure fields (description/category/contact/schema mapping).",
    });
  } else if (scores.structure < 30) {
    caps.push({ kind: "structure_gate", cap: 50, reason: "Structure score below 30." });
  } else if (scores.structure < 50) {
    caps.push({ kind: "structure_gate", cap: 65, reason: "Structure score 30-49." });
  } else if (scores.structure < 70) {
    caps.push({ kind: "structure_gate", cap: 80, reason: "Structure score 50-69." });
  }

  if (scores.clarity < 25) {
    caps.push({ kind: "clarity_cap", cap: 60, reason: "Clarity score below 25." });
  } else if (scores.clarity < 40) {
    caps.push({ kind: "clarity_cap", cap: 70, reason: "Clarity score below 40." });
  }

  const hasLinkIntegrityFailure = input.authorityPosts.slice(0, 4).some(
    (post) => !post.blogToListingLinked || !post.listingToBlogLinked
  );

  if (hasLinkIntegrityFailure && input.authorityPosts.slice(0, 4).some((post) => post.status !== "not_created")) {
    caps.push({
      kind: "authority_ceiling",
      cap: 50,
      reason: "Missing bidirectional links between listing and authority post.",
    });
  }

  if (scores.authority < 30) {
    caps.push({ kind: "authority_ceiling", cap: 65, reason: "Authority score below 30." });
  } else if (scores.authority < 50) {
    caps.push({ kind: "authority_ceiling", cap: 75, reason: "Authority score 30-49." });
  } else if (scores.authority < 75) {
    caps.push({ kind: "authority_ceiling", cap: 85, reason: "Authority score 50-74." });
  }

  if (riskTier === "high") {
    if (scores.trust < 35) {
      caps.push({ kind: "trust_risk_cap", cap: 60, reason: "High-risk vertical with trust score below 35." });
    } else if (scores.trust < 50) {
      caps.push({ kind: "trust_risk_cap", cap: 70, reason: "High-risk vertical with trust score below 50." });
    }
  }

  const penalized = clamp(weightedRaw - clarityEval.ambiguityPenalty, 0, 100);
  const capValue = caps.length > 0 ? Math.min(...caps.map((cap) => cap.cap)) : 100;
  const totalScore = round(Math.min(penalized, capValue));

  const flags: EvaluationFlags = {
    structuralGateActive: caps.some((cap) => cap.kind === "structure_gate"),
    structuralHardFailActive: caps.some((cap) => cap.kind === "structure_hard_fail"),
    authorityCeilingActive: caps.some((cap) => cap.kind === "authority_ceiling"),
    ambiguityPenaltyApplied: clarityEval.ambiguityPenalty > 0,
    trustRiskCapActive: caps.some((cap) => cap.kind === "trust_risk_cap"),
  };

  return {
    listingId: input.listingId,
    vertical,
    riskTier,
    scores: {
      structure: round(scores.structure),
      clarity: round(scores.clarity),
      trust: round(scores.trust),
      authority: round(scores.authority),
      actionability: round(scores.actionability),
    },
    weightedRawScore: round(weightedRaw),
    ambiguityPenalty: clarityEval.ambiguityPenalty,
    totalScore,
    caps,
    flags,
    authority: {
      consideredPosts: authorityEval.consideredPosts,
      bidirectionalReadyCount: authorityEval.bidirectionalReadyCount,
      maxPostsEnforced: authorityEval.maxPostsEnforced,
    },
    gapsByPillar: gaps(input, scores, { bidirectionalReadyCount: authorityEval.bidirectionalReadyCount }),
  };
}

export function computeSiteReadiness(evaluations: ListingSelectionEvaluation[]): {
  readiness: number;
  pillars: PillarScores;
} {
  if (evaluations.length === 0) {
    return {
      readiness: 0,
      pillars: { structure: 0, clarity: 0, trust: 0, authority: 0, actionability: 0 },
    };
  }

  const sum = evaluations.reduce(
    (acc, current) => {
      acc.readiness += current.totalScore;
      acc.p.structure += current.scores.structure;
      acc.p.clarity += current.scores.clarity;
      acc.p.trust += current.scores.trust;
      acc.p.authority += current.scores.authority;
      acc.p.actionability += current.scores.actionability;
      return acc;
    },
    {
      readiness: 0,
      p: { structure: 0, clarity: 0, trust: 0, authority: 0, actionability: 0 },
    }
  );

  return {
    readiness: round(sum.readiness / evaluations.length),
    pillars: {
      structure: round(sum.p.structure / evaluations.length),
      clarity: round(sum.p.clarity / evaluations.length),
      trust: round(sum.p.trust / evaluations.length),
      authority: round(sum.p.authority / evaluations.length),
      actionability: round(sum.p.actionability / evaluations.length),
    },
  };
}
