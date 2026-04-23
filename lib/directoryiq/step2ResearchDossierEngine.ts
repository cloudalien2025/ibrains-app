import {
  buildSeoPackageFromBrief,
  buildSupportBrief,
  type Step2MissionPlan,
  type Step2MissionPlanSlot,
  type Step2PrimarySlot,
  type Step2ResearchContentType,
  type Step2SupportBrief,
  type Step2SupportResearchArtifact,
} from "@/lib/directoryiq/step2SupportEngineContract";
import { buildStep2SerpDossierEnrichment } from "@/lib/directoryiq/step2SerpDossierEnrichment";

type ListingSupportEvidenceModel = {
  listing?: {
    title?: string | null;
    canonicalUrl?: string | null;
    siteId?: string | null;
  } | null;
  summary?: {
    inboundLinkedSupportCount?: number;
    mentionWithoutLinkCount?: number;
    connectedSupportPageCount?: number;
    lastGraphRunAt?: string | null;
  } | null;
  inboundLinkedSupport?: Array<{ title?: string | null; url?: string | null; anchors?: string[] }>;
  mentionsWithoutLinks?: Array<{ title?: string | null; url?: string | null; mentionSnippet?: string | null }>;
  connectedSupportPages?: Array<{ title?: string | null; url?: string | null; type?: string | null }>;
};

type SlotContractSeed = {
  slot: number;
  missionPlanSlot: Record<string, unknown>;
};

type DossierListingIdentity = {
  listing_source_id: string;
  listing_id: string;
  listing_title: string;
  listing_url: string | null;
  site_id: string | null;
  category: string | null;
  location_city: string | null;
  location_region: string | null;
};

export type Step2SelectionResearchDossierPhase1 = {
  dossier_version: "phase1.v2";
  generated_at: string;
  owner_key: string;
  listing_identity: DossierListingIdentity;
  first_party_facts: {
    listing_description: string | null;
    listing_type: string | null;
    category: string | null;
    location_city: string | null;
    location_region: string | null;
  };
  same_site_support: {
    inbound_linked_support: Array<{ title: string; url: string | null; anchors: string[] }>;
    mention_without_links: Array<{ title: string; url: string | null; snippet: string | null }>;
    connected_support_pages: Array<{ title: string; url: string | null; page_type: string | null }>;
    summary: {
      inbound_count: number;
      mention_count: number;
      connected_count: number;
      last_graph_run_at: string | null;
    };
  };
  normalized_facts: {
    topic_tokens: string[];
    intent_tokens: string[];
    location_tokens: string[];
    same_site_signal_strength: "none" | "thin" | "supported";
  };
  serp_results: Array<{
    title: string;
    link: string;
    snippet: string;
    position: number;
  }>;
  serp_summary: {
    common_topics: string[];
    common_phrases: string[];
    faq_patterns: string[];
  };
  entities: {
    amenities: string[];
    location: string[];
    intent: string[];
  };
  evidence_gaps: string[];
  research_metadata: {
    enrichment_provider: "disabled_phase1" | "serpapi";
    enrichment_status: "not_attempted" | "ready" | "failed";
    confidence_band: "low" | "medium";
    serp_query: string | null;
    serp_location: string | null;
    serp_error: string | null;
  };
  step2_slot_research: Array<{
    slot: number;
    slot_id: string;
    focus_keyword: string;
    evidence_quality: "thin" | "supported";
    top_results_count: number;
  }>;
};

export type DossierBackedStep2Contract = {
  slot: number;
  step2_contract: {
    mission_plan_slot: Step2MissionPlanSlot;
    support_brief: Step2SupportBrief;
    seo_package: ReturnType<typeof buildSeoPackageFromBrief>;
    research_artifact: Step2SupportResearchArtifact;
    research_dossier: Step2SelectionResearchDossierPhase1;
  };
};

type BuildInput = {
  generatedAtIso: string;
  listing: DossierListingIdentity & {
    listing_description: string | null;
    listing_type: string | null;
  };
  sameSiteSupport: ListingSupportEvidenceModel;
  slots: SlotContractSeed[];
  serpApiKey: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNullable(value: unknown): string | null {
  const parsed = asString(value);
  return parsed || null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => Boolean(entry));
}

function dedupe(values: Array<string | null | undefined>): string[] {
  const next: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = (value ?? "").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(normalized);
  }
  return next;
}

function isSyntheticResearchUrl(value: string): boolean {
  return /research\.local/i.test(value);
}

function safeUrl(value: unknown): string | null {
  const candidate = asString(value);
  if (!candidate || isSyntheticResearchUrl(candidate)) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKeyword(input: string): string {
  const normalized = slugPart(input).replace(/\s+/g, " ").trim();
  return normalized;
}

function primarySlot(value: unknown): Step2PrimarySlot {
  const parsed = asString(value);
  if (
    parsed === "best_of" ||
    parsed === "audience_fit" ||
    parsed === "location_intent" ||
    parsed === "comparison" ||
    parsed === "experience_itinerary"
  ) {
    return parsed;
  }
  return "comparison";
}

function postType(value: unknown): Step2ResearchContentType {
  const parsed = asString(value);
  if (
    parsed === "listicle" ||
    parsed === "local_guide" ||
    parsed === "comparison" ||
    parsed === "itinerary" ||
    parsed === "roundup" ||
    parsed === "informational_guide"
  ) {
    return parsed;
  }
  return "informational_guide";
}

function inferContentTypeFromTitle(value: string): Step2ResearchContentType {
  const lower = value.toLowerCase();
  if (/(versus|vs|compare|comparison|alternative)/.test(lower)) return "comparison";
  if (/(itinerary|day plan|weekend|route)/.test(lower)) return "itinerary";
  if (/(local|near|neighborhood|area|city)/.test(lower)) return "local_guide";
  if (/(best|top|roundup|choices)/.test(lower)) return "roundup";
  if (/(guide|how to|tips|checklist|faq)/.test(lower)) return "informational_guide";
  return "listicle";
}

function inferKeyword(input: {
  seed: Record<string, unknown>;
  listing: BuildInput["listing"];
}): string {
  const requested = normalizeKeyword(asString(input.seed.recommended_focus_keyword));
  if (requested) return requested;
  const category = normalizeKeyword(input.listing.category ?? "");
  const city = normalizeKeyword(input.listing.location_city ?? "");
  const title = normalizeKeyword(input.listing.listing_title);
  const merged = [category, city, title].filter(Boolean).join(" ");
  const normalized = normalizeKeyword(merged);
  return normalized || normalizeKeyword(input.listing.listing_title) || "listing";
}

function coerceMissionPlanSlot(input: {
  seed: Record<string, unknown>;
  slot: number;
  listing: BuildInput["listing"];
  fallbackKeyword: string;
}): Step2MissionPlanSlot {
  const seed = input.seed;
  const slotId =
    asString(seed.slot_id) ||
    `slot_${input.slot}_${(input.fallbackKeyword || input.listing.listing_title).replace(/\s+/g, "_").toLowerCase()}`;
  const listingUrl = safeUrl(seed.listing_url) ?? input.listing.listing_url;
  return {
    slot_id: slotId,
    primary_slot: primarySlot(seed.primary_slot),
    listing_url: listingUrl,
    slot_label: asString(seed.slot_label) || `Support Slot ${input.slot}`,
    slot_reason: asString(seed.slot_reason) || "Phase 1 listing-first dossier support.",
    target_query_family: dedupe([
      ...asStringArray(seed.target_query_family),
      input.listing.category,
      input.listing.location_city,
      input.listing.location_region,
    ]),
    recommended_focus_keyword: input.fallbackKeyword,
    recommended_angle: asString(seed.recommended_angle) || `Decision support for ${input.listing.listing_title}`,
    existing_candidate_post_id: toNullable(seed.existing_candidate_post_id),
    existing_candidate_url: safeUrl(seed.existing_candidate_url),
    existing_candidate_title: toNullable(seed.existing_candidate_title),
    current_state: "missing",
    recommended_action: "create",
    counts_toward_required_five_now: false,
    step1_confidence: 0.5,
    selected_for_mission: true,
  };
}

function collectSameSiteEvidence(input: BuildInput): Array<{ title: string; url: string; content_type: Step2ResearchContentType }> {
  const evidence: Array<{ title: string; url: string; content_type: Step2ResearchContentType }> = [];
  const listingUrl = safeUrl(input.listing.listing_url);
  if (listingUrl) {
    evidence.push({
      title: input.listing.listing_title,
      url: listingUrl,
      content_type: "informational_guide",
    });
  }

  for (const entry of input.sameSiteSupport.inboundLinkedSupport ?? []) {
    const url = safeUrl(entry.url);
    if (!url) continue;
    evidence.push({
      title: asString(entry.title) || "Support article linking to listing",
      url,
      content_type: "comparison",
    });
  }

  for (const entry of input.sameSiteSupport.mentionsWithoutLinks ?? []) {
    const url = safeUrl(entry.url);
    if (!url) continue;
    evidence.push({
      title: asString(entry.title) || "Support mention",
      url,
      content_type: "informational_guide",
    });
  }

  for (const entry of input.sameSiteSupport.connectedSupportPages ?? []) {
    const url = safeUrl(entry.url);
    if (!url) continue;
    evidence.push({
      title: asString(entry.title) || "Connected support page",
      url,
      content_type: "local_guide",
    });
  }

  const deduped: Array<{ title: string; url: string; content_type: Step2ResearchContentType }> = [];
  const seen = new Set<string>();
  for (const entry of evidence) {
    const key = entry.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }
  return deduped.slice(0, 10);
}

function toStep2MissionPlan(input: { listing: BuildInput["listing"]; slot: Step2MissionPlanSlot }): Step2MissionPlan {
  return {
    listing_id: input.listing.listing_id,
    site_id: input.listing.site_id,
    listing_title: input.listing.listing_title,
    listing_url: input.listing.listing_url,
    listing_type: input.listing.listing_type ?? "",
    listing_category: input.listing.category ?? "",
    listing_subcategory: "",
    location_city: input.listing.location_city ?? "",
    location_area: "",
    location_region: input.listing.location_region ?? "",
    landmarks: [],
    differentiators: [],
    audience_fits: [],
    core_entities: dedupe([input.listing.listing_title, input.listing.category]),
    required_valid_support_count: 5,
    selected_slots: [input.slot],
  };
}

export function isDossierBackedResearchArtifact(value: unknown): boolean {
  const artifact = asRecord(value);
  const keyword = asString(artifact.focus_keyword);
  if (!keyword) return false;
  const topResults = Array.isArray(artifact.top_results) ? artifact.top_results : [];
  if (!topResults.length) return false;
  return topResults.every((entry) => {
    const row = asRecord(entry);
    const url = asString(row.url);
    return Boolean(url) && !isSyntheticResearchUrl(url);
  });
}

export async function buildStep2SelectionResearchDossierPhase1(input: BuildInput): Promise<{
  dossier: Step2SelectionResearchDossierPhase1;
  contracts: DossierBackedStep2Contract[];
}> {
  const sameSiteEvidence = collectSameSiteEvidence(input);
  const sameSiteSignalStrength: "none" | "thin" | "supported" =
    sameSiteEvidence.length >= 3 ? "supported" : sameSiteEvidence.length > 0 ? "thin" : "none";
  const baseEvidenceGaps = dedupe([
    input.listing.listing_url ? null : "Listing canonical URL is missing.",
    input.listing.listing_description ? null : "Listing description content is thin or unavailable.",
    sameSiteEvidence.length > 0 ? null : "No same-site support evidence with canonical URLs was found.",
  ]);
  const serpEnrichment = await buildStep2SerpDossierEnrichment({
    listingTitle: input.listing.listing_title,
    listingCategory: input.listing.category,
    listingCity: input.listing.location_city,
    listingRegion: input.listing.location_region,
    listingDescription: input.listing.listing_description,
    apiKey: input.serpApiKey,
  });
  const evidenceGaps = dedupe([...baseEvidenceGaps, ...serpEnrichment.evidence_gaps]);
  const serpTopResults = serpEnrichment.organic_results
    .map((row) => ({
      title: row.title,
      url: row.link,
      rank: row.position,
      content_type: inferContentTypeFromTitle(row.title),
    }))
    .filter((row) => Boolean(row.url));

  const contracts: DossierBackedStep2Contract[] = input.slots.map((entry) => {
    const seed = asRecord(entry.missionPlanSlot);
    const focusKeyword = inferKeyword({ seed, listing: input.listing });
    const missionPlanSlot = coerceMissionPlanSlot({
      seed,
      slot: entry.slot,
      listing: input.listing,
      fallbackKeyword: focusKeyword,
    });

    const topResults =
      serpTopResults.length > 0
        ? serpTopResults.slice(0, 10)
        : sameSiteEvidence.slice(0, 5).map((item, index) => ({
            title: item.title,
            url: item.url,
            rank: index + 1,
            content_type: item.content_type,
          }));
    const faqQuestions = dedupe([
      ...serpEnrichment.summary.faq_patterns,
      ...evidenceGaps.map((gap) => `What should I verify before booking: ${gap.replace(/\.$/, "")}?`),
    ]);
    const commonEntities = dedupe([
      input.listing.listing_title,
      input.listing.category,
      input.listing.location_city,
      ...serpEnrichment.entities.amenities,
      ...serpEnrichment.entities.intent,
    ]).slice(0, 12);
    const commonHeadings = dedupe([
      ...serpEnrichment.summary.common_topics.map((topic) => `What to know about ${topic}`),
      ...serpEnrichment.summary.common_phrases.map((phrase) => phrase.replace(/\b\w/g, (char) => char.toUpperCase())),
      `How ${input.listing.listing_title} fits this decision`,
      "Evidence-backed decision points",
    ]);

    const artifact: Step2SupportResearchArtifact = {
      slot_id: missionPlanSlot.slot_id,
      primary_slot: missionPlanSlot.primary_slot,
      focus_keyword: focusKeyword,
      query_variants: dedupe([
        focusKeyword,
        `${focusKeyword} ${input.listing.location_city ?? ""}`,
        `${focusKeyword} ${input.listing.location_region ?? ""}`,
      ]),
      top_results: topResults,
      dominant_format: topResults[0]?.content_type ?? postType(seed.post_type),
      common_title_patterns: dedupe([`${focusKeyword} guide`, `${focusKeyword} for ${input.listing.listing_title}`]),
      common_headings: commonHeadings.slice(0, 10),
      common_entities: commonEntities,
      common_locations: dedupe([input.listing.location_city, input.listing.location_region]).slice(0, 8),
      common_user_questions: faqQuestions.slice(0, 8),
      common_decision_factors: dedupe([
        ...serpEnrichment.entities.intent,
        "fit",
        "location",
        "proof",
        "availability",
      ]),
      content_gaps_opportunities: evidenceGaps.length
        ? evidenceGaps
        : ["Expand same-site supporting evidence to increase dossier confidence."],
      recommended_winning_angle:
        asString(seed.recommended_angle) ||
        `Use listing-first evidence to explain when ${input.listing.listing_title} is the right choice.`,
      recommended_title_pattern: `${focusKeyword} | ${input.listing.listing_title}`,
      recommended_outline_pattern: ["Quick answer", "Fit criteria", "Evidence", "Decision summary"],
      listing_insertion_strategy:
        "Anchor the listing with one contextual recommendation and one direct internal link to the canonical listing URL.",
      seo_notes: [
        "Keyword intent must remain listing-first and evidence-backed.",
        "Avoid unsupported claims when same-site evidence is thin.",
      ],
    };

    const plan = toStep2MissionPlan({ listing: input.listing, slot: missionPlanSlot });
    const brief = buildSupportBrief({
      slot: missionPlanSlot,
      plan,
      research: artifact,
    });
    const seoPackage = buildSeoPackageFromBrief(brief);

    return {
      slot: entry.slot,
      step2_contract: {
        mission_plan_slot: missionPlanSlot,
        support_brief: brief,
        seo_package: seoPackage,
        research_artifact: artifact,
        research_dossier: {} as Step2SelectionResearchDossierPhase1,
      },
    };
  });

  const dossier: Step2SelectionResearchDossierPhase1 = {
    dossier_version: "phase1.v2",
    generated_at: input.generatedAtIso,
    owner_key: `${input.listing.listing_source_id}:phase1.v2`,
    listing_identity: {
      listing_source_id: input.listing.listing_source_id,
      listing_id: input.listing.listing_id,
      listing_title: input.listing.listing_title,
      listing_url: input.listing.listing_url,
      site_id: input.listing.site_id,
      category: input.listing.category,
      location_city: input.listing.location_city,
      location_region: input.listing.location_region,
    },
    first_party_facts: {
      listing_description: input.listing.listing_description,
      listing_type: input.listing.listing_type,
      category: input.listing.category,
      location_city: input.listing.location_city,
      location_region: input.listing.location_region,
    },
    same_site_support: {
      inbound_linked_support: (input.sameSiteSupport.inboundLinkedSupport ?? []).slice(0, 8).map((entry) => ({
        title: asString(entry.title) || "Support article",
        url: safeUrl(entry.url),
        anchors: asStringArray(entry.anchors).slice(0, 6),
      })),
      mention_without_links: (input.sameSiteSupport.mentionsWithoutLinks ?? []).slice(0, 8).map((entry) => ({
        title: asString(entry.title) || "Support mention",
        url: safeUrl(entry.url),
        snippet: toNullable(entry.mentionSnippet),
      })),
      connected_support_pages: (input.sameSiteSupport.connectedSupportPages ?? []).slice(0, 8).map((entry) => ({
        title: asString(entry.title) || "Connected support page",
        url: safeUrl(entry.url),
        page_type: toNullable(entry.type),
      })),
      summary: {
        inbound_count: Number(input.sameSiteSupport.summary?.inboundLinkedSupportCount ?? 0) || 0,
        mention_count: Number(input.sameSiteSupport.summary?.mentionWithoutLinkCount ?? 0) || 0,
        connected_count: Number(input.sameSiteSupport.summary?.connectedSupportPageCount ?? 0) || 0,
        last_graph_run_at: toNullable(input.sameSiteSupport.summary?.lastGraphRunAt),
      },
    },
    normalized_facts: {
      topic_tokens: dedupe([
        input.listing.category,
        input.listing.listing_type,
        input.listing.listing_title,
        ...serpEnrichment.summary.common_topics,
      ])
        .map(slugPart)
        .filter(Boolean),
      intent_tokens: dedupe(["comparison intent", "selection intent", "fit validation", ...serpEnrichment.entities.intent]),
      location_tokens: dedupe([input.listing.location_city, input.listing.location_region]).map(slugPart).filter(Boolean),
      same_site_signal_strength: sameSiteSignalStrength,
    },
    serp_results: serpEnrichment.organic_results.map((entry) => ({
      title: entry.title,
      link: entry.link,
      snippet: entry.snippet,
      position: entry.position,
    })),
    serp_summary: {
      common_topics: serpEnrichment.summary.common_topics,
      common_phrases: serpEnrichment.summary.common_phrases,
      faq_patterns: serpEnrichment.summary.faq_patterns,
    },
    entities: {
      amenities: serpEnrichment.entities.amenities,
      location: serpEnrichment.entities.location,
      intent: serpEnrichment.entities.intent,
    },
    evidence_gaps: evidenceGaps,
    research_metadata: {
      enrichment_provider: serpEnrichment.provider === "serpapi" ? "serpapi" : "disabled_phase1",
      enrichment_status:
        serpEnrichment.status === "ready"
          ? "ready"
          : serpEnrichment.status === "failed"
            ? "failed"
            : "not_attempted",
      confidence_band: sameSiteSignalStrength === "supported" ? "medium" : "low",
      serp_query: serpEnrichment.query || null,
      serp_location: serpEnrichment.location || null,
      serp_error: serpEnrichment.error_message,
    },
    step2_slot_research: contracts.map((entry) => ({
      slot: entry.slot,
      slot_id: entry.step2_contract.mission_plan_slot.slot_id,
      focus_keyword: entry.step2_contract.research_artifact.focus_keyword,
      evidence_quality: sameSiteSignalStrength === "supported" ? "supported" : "thin",
      top_results_count: entry.step2_contract.research_artifact.top_results.length,
    })),
  };

  return {
    dossier,
    contracts: contracts.map((entry) => ({
      ...entry,
      step2_contract: {
        ...entry.step2_contract,
        research_dossier: dossier,
      },
    })),
  };
}
