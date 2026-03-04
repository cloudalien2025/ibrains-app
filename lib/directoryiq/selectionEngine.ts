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
  riskTierOverride: RiskTier | null;
  authorityPosts: AuthorityPostInput[];
};

export type ListingSelectionEvaluation = {
  listingId: string;
  vertical: DirectoryIqVerticalId;
  riskTier: RiskTier;
  totalScore: number;
  scores: {
    structure: number;
    clarity: number;
    trust: number;
    authority: number;
    actionability: number;
  };
  caps: {
    authorityCap: number;
    trustCap: number;
  };
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function detectVerticalFromSignals(category: string, taxonomySignals: string[]): DirectoryIqVerticalId {
  const text = `${category} ${taxonomySignals.join(" ")}`.toLowerCase();
  if (/(hotel|restaurant|travel|tour|hospitality|resort)/.test(text)) return "hospitality-travel";
  if (/(medical|dental|clinic|health)/.test(text)) return "health-medical";
  if (/(law|legal|attorney|finance|accounting|tax)/.test(text)) return "legal-financial";
  if (/(school|education|training|academy)/.test(text)) return "education";
  if (/(home|plumb|electric|roof|contractor|service)/.test(text)) return "home-services";
  return "general";
}

export function evaluateListingSelection(input: ListingSelectionInput): ListingSelectionEvaluation {
  const riskTier: RiskTier = input.riskTierOverride ?? "medium";

  const structure = clamp(60 + input.schemaSignals.length * 3 + input.taxonomySignals.length, 0, 100);
  const clarity = clamp(60 + (input.description ? 10 : 0) + (input.ctaText ? 5 : 0), 0, 100);
  const trust = clamp(
    50 +
      input.credentialsSignals.length * 5 +
      input.evidenceSignals.length * 4 +
      Math.round((input.averageRating ?? 0) * 4) +
      Math.min(10, input.reviewCount / 10),
    0,
    100
  );
  const authority = clamp(
    50 +
      input.authorityPosts.filter((post) => post.status === "published").length * 10 +
      input.authorityPosts.filter((post) => post.blogToListingLinked && post.listingToBlogLinked).length * 5,
    0,
    100
  );
  const actionability = clamp(55 + (input.contact ? 8 : 0) + (input.ctaText ? 8 : 0), 0, 100);

  const authorityCap = riskTier === "high" ? 90 : 100;
  const trustCap = riskTier === "high" ? 92 : 100;

  const boundedAuthority = Math.min(authority, authorityCap);
  const boundedTrust = Math.min(trust, trustCap);
  const totalScore = Math.round((structure + clarity + boundedTrust + boundedAuthority + actionability) / 5);

  return {
    listingId: input.listingId,
    vertical: input.vertical,
    riskTier,
    totalScore,
    scores: {
      structure,
      clarity,
      trust: boundedTrust,
      authority: boundedAuthority,
      actionability,
    },
    caps: {
      authorityCap,
      trustCap,
    },
  };
}

export function computeSiteReadiness(evaluations: ListingSelectionEvaluation[]): {
  readiness: number;
  pillars: {
    structure: number;
    clarity: number;
    trust: number;
    authority: number;
    actionability: number;
  };
} {
  if (evaluations.length === 0) {
    return {
      readiness: 0,
      pillars: {
        structure: 0,
        clarity: 0,
        trust: 0,
        authority: 0,
        actionability: 0,
      },
    };
  }

  const totals = evaluations.reduce(
    (acc, row) => {
      acc.structure += row.scores.structure;
      acc.clarity += row.scores.clarity;
      acc.trust += row.scores.trust;
      acc.authority += row.scores.authority;
      acc.actionability += row.scores.actionability;
      acc.total += row.totalScore;
      return acc;
    },
    { structure: 0, clarity: 0, trust: 0, authority: 0, actionability: 0, total: 0 }
  );

  const count = evaluations.length;
  return {
    readiness: Math.round(totals.total / count),
    pillars: {
      structure: Math.round(totals.structure / count),
      clarity: Math.round(totals.clarity / count),
      trust: Math.round(totals.trust / count),
      authority: Math.round(totals.authority / count),
      actionability: Math.round(totals.actionability / count),
    },
  };
}

export function evaluateSelection(): {
  totalScore: number;
  scores: {
    structure: number;
    clarity: number;
    trust: number;
    authority: number;
    actionability: number;
  };
} {
  return {
    totalScore: 75,
    scores: {
      structure: 75,
      clarity: 75,
      trust: 75,
      authority: 75,
      actionability: 75,
    },
  };
}
