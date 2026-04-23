import { hasUsableStep2ResearchArtifact, type Step2ResearchState } from "@/lib/directoryiq/step2ResearchGateContract";

type DossierListingIdentity = {
  listing_source_id?: unknown;
  listing_id?: unknown;
  listing_url?: unknown;
};

type DossierSummary = {
  inbound_count?: unknown;
  mention_count?: unknown;
  connected_count?: unknown;
};

type DossierSameSiteSupport = {
  summary?: DossierSummary;
};

type DossierFirstPartyFacts = {
  category?: unknown;
  location_city?: unknown;
  location_region?: unknown;
  listing_description?: unknown;
};

type DossierResearchMetadata = {
  enrichment_provider?: unknown;
  enrichment_status?: unknown;
  serp_error?: unknown;
};

type Step2SelectionResearchDossierInput = {
  listing_identity?: DossierListingIdentity;
  step2_slot_research?: unknown[];
  same_site_support?: DossierSameSiteSupport;
  first_party_facts?: DossierFirstPartyFacts;
  normalized_facts?: {
    topic_tokens?: unknown[];
    intent_tokens?: unknown[];
    location_tokens?: unknown[];
  };
  serp_results?: unknown[];
  research_metadata?: DossierResearchMetadata;
};

export type Step2ResearchOutcome = {
  state: Extract<Step2ResearchState, "ready_thin" | "ready_grounded" | "failed">;
  errorCode: string | null;
  errorMessage: string | null;
  qualityReason:
    | "grounded"
    | "serp_api_missing"
    | "serp_grounding_incomplete"
    | "serp_enrichment_failed"
    | "fallback_evidence_only"
    | "missing_listing_evidence"
    | "no_usable_artifact";
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => asString(entry)).filter(Boolean);
}

function safeNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isGroundedSerpTop10(dossier: Step2SelectionResearchDossierInput): boolean {
  const serpResultsCount = Array.isArray(dossier.serp_results) ? dossier.serp_results.length : 0;
  const status = asString(asRecord(dossier.research_metadata).enrichment_status);
  return status === "ready" && serpResultsCount >= 10;
}

function hasListingIdentity(dossier: Step2SelectionResearchDossierInput): boolean {
  const listingIdentity = asRecord(dossier.listing_identity);
  return Boolean(asString(listingIdentity.listing_source_id) || asString(listingIdentity.listing_id));
}

function hasCanonicalListingReference(input: {
  dossier: Step2SelectionResearchDossierInput;
  listingUrl: string | null;
}): boolean {
  const listingIdentity = asRecord(input.dossier.listing_identity);
  return Boolean(input.listingUrl || asString(listingIdentity.listing_url) || asString(listingIdentity.listing_id));
}

function hasMissionPlanSlots(dossier: Step2SelectionResearchDossierInput, slotsRequested: number): boolean {
  const slotResearch = Array.isArray(dossier.step2_slot_research) ? dossier.step2_slot_research : [];
  if (slotResearch.length <= 0) return false;
  return slotsRequested <= 0 ? true : slotResearch.length >= 1;
}

function countSameSiteEvidence(dossier: Step2SelectionResearchDossierInput): number {
  const summary = asRecord(asRecord(dossier.same_site_support).summary);
  return safeNumber(summary.inbound_count) + safeNumber(summary.mention_count) + safeNumber(summary.connected_count);
}

function hasFirstPartyContext(dossier: Step2SelectionResearchDossierInput): boolean {
  const firstPartyFacts = asRecord(dossier.first_party_facts);
  const normalizedFacts = asRecord(dossier.normalized_facts);
  const hasPrimaryFacts = Boolean(
    asString(firstPartyFacts.category) ||
      asString(firstPartyFacts.location_city) ||
      asString(firstPartyFacts.location_region) ||
      asString(firstPartyFacts.listing_description)
  );
  const hasTokenFacts =
    asStringArray(normalizedFacts.topic_tokens).length >= 1 ||
    asStringArray(normalizedFacts.intent_tokens).length >= 1 ||
    asStringArray(normalizedFacts.location_tokens).length >= 1;
  return hasPrimaryFacts || hasTokenFacts;
}

function toThinReason(dossier: Step2SelectionResearchDossierInput): Step2ResearchOutcome["qualityReason"] {
  const metadata = asRecord(dossier.research_metadata);
  const provider = asString(metadata.enrichment_provider);
  const status = asString(metadata.enrichment_status);

  if (provider === "disabled_phase1" || status === "not_attempted") return "serp_api_missing";
  if (status === "failed") return "serp_enrichment_failed";
  if (provider === "serpapi" && status !== "ready") return "serp_grounding_incomplete";
  return "fallback_evidence_only";
}

export function classifyStep2ResearchOutcome(input: {
  listingUrl: string | null;
  slotsRequested: number;
  usableContractsCount: number;
  dossier: Step2SelectionResearchDossierInput;
  contracts: Array<{ step2_contract?: Record<string, unknown> }>;
}): Step2ResearchOutcome {
  if (input.usableContractsCount <= 0) {
    return {
      state: "failed",
      errorCode: "DOSSIER_EMPTY",
      errorMessage: "Research dossier could not produce a usable listing-backed artifact.",
      qualityReason: "no_usable_artifact",
    };
  }

  const hasAtLeastOneUsableContract = input.contracts.some((entry) =>
    hasUsableStep2ResearchArtifact(asRecord(asRecord(entry.step2_contract).research_artifact))
  );

  if (!hasAtLeastOneUsableContract) {
    return {
      state: "failed",
      errorCode: "DOSSIER_EMPTY",
      errorMessage: "Research dossier could not produce a usable listing-backed artifact.",
      qualityReason: "no_usable_artifact",
    };
  }

  if (isGroundedSerpTop10(input.dossier)) {
    return {
      state: "ready_grounded",
      errorCode: null,
      errorMessage: null,
      qualityReason: "grounded",
    };
  }

  const fallbackSafe =
    hasListingIdentity(input.dossier) &&
    hasCanonicalListingReference({ dossier: input.dossier, listingUrl: input.listingUrl }) &&
    hasMissionPlanSlots(input.dossier, input.slotsRequested) &&
    (countSameSiteEvidence(input.dossier) > 0 ||
      (Array.isArray(input.dossier.serp_results) && input.dossier.serp_results.length > 0) ||
      hasFirstPartyContext(input.dossier));

  if (!fallbackSafe) {
    return {
      state: "failed",
      errorCode: "FALLBACK_RESEARCH_UNUSABLE",
      errorMessage: "Research artifact is missing required listing evidence.",
      qualityReason: "missing_listing_evidence",
    };
  }

  return {
    state: "ready_thin",
    errorCode: null,
    errorMessage: null,
    qualityReason: toThinReason(input.dossier),
  };
}

export function deriveStep2ThinResearchMessage(reason: Step2ResearchOutcome["qualityReason"]): string {
  if (reason === "serp_api_missing") return "SerpAPI is not configured. Using fallback research.";
  if (reason === "serp_enrichment_failed" || reason === "serp_grounding_incomplete") {
    return "SERP grounding is incomplete. Support drafts will use fallback evidence.";
  }
  return "Using fallback research evidence for this listing.";
}

export function deriveStep2ResearchFailureMessage(input: {
  code: string | null | undefined;
  fallbackMessage?: string | null;
}): string {
  const code = asString(input.code).toUpperCase();
  if (code === "DOSSIER_EMPTY") return "Research failed. Retry after fixing inputs.";
  if (code === "FALLBACK_RESEARCH_UNUSABLE") return "Research artifact is missing required listing evidence.";
  if (code === "SERP_GROUNDED_RESEARCH_REQUIRED") {
    return "SERP grounding is incomplete. Support drafts will use fallback evidence.";
  }
  return asString(input.fallbackMessage) || "Research failed. Retry after fixing inputs.";
}
