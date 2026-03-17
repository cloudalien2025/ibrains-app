import { REQUIRED_VALID_SUPPORT_COUNT } from "@/lib/directoryiq/missionControlContract";

export type Step2PrimarySlot =
  | "best_of"
  | "audience_fit"
  | "location_intent"
  | "comparison"
  | "experience_itinerary";

export type Step2SlotCurrentState = "missing" | "upgrade_candidate" | "valid";
export type Step2RecommendedAction = "create" | "upgrade" | "confirm";

export type Step2MissionPlan = {
  listing_id: string;
  site_id: string | null;
  listing_title: string;
  listing_url: string | null;
  listing_type: string;
  listing_category: string;
  listing_subcategory: string;
  location_city: string;
  location_area: string;
  location_region: string;
  landmarks: string[];
  differentiators: string[];
  audience_fits: string[];
  core_entities: string[];
  required_valid_support_count: number;
  selected_slots: Step2MissionPlanSlot[];
};

export type Step2MissionPlanSlot = {
  slot_id: string;
  primary_slot: Step2PrimarySlot;
  slot_label: string;
  slot_reason: string;
  target_query_family: string[];
  recommended_focus_keyword: string;
  recommended_angle: string;
  existing_candidate_post_id: string | null;
  existing_candidate_url: string | null;
  existing_candidate_title: string | null;
  current_state: Step2SlotCurrentState;
  recommended_action: Step2RecommendedAction;
  counts_toward_required_five_now: boolean;
  step1_confidence: number;
  selected_for_mission: true;
};

export type Step2ResearchContentType =
  | "listicle"
  | "local_guide"
  | "comparison"
  | "itinerary"
  | "roundup"
  | "informational_guide";

export type Step2ResearchTopResult = {
  title: string;
  url: string;
  rank: number;
  content_type: Step2ResearchContentType;
};

export type Step2SupportResearchArtifact = {
  slot_id: string;
  primary_slot: Step2PrimarySlot;
  focus_keyword: string;
  query_variants: string[];
  top_results: Step2ResearchTopResult[];
  dominant_format: Step2ResearchContentType;
  common_title_patterns: string[];
  common_headings: string[];
  common_entities: string[];
  common_locations: string[];
  common_user_questions: string[];
  common_decision_factors: string[];
  content_gaps_opportunities: string[];
  recommended_winning_angle: string;
  recommended_title_pattern: string;
  recommended_outline_pattern: string[];
  listing_insertion_strategy: string;
  seo_notes: string[];
};

export type Step2SeoPackage = {
  primary_focus_keyword: string;
  post_title: string;
  seo_title: string;
  meta_description: string;
  slug: string;
  featured_image_filename: string;
  featured_image_alt_text: string;
};

export type Step2SupportBrief = {
  slot_id: string;
  primary_slot: Step2PrimarySlot;
  focus_keyword: string;
  secondary_keywords: string[];
  post_type: Step2ResearchContentType;
  article_title: string;
  seo_title: string;
  meta_description: string;
  slug: string;
  featured_image_filename: string;
  featured_image_alt_text: string;
  recommended_angle: string;
  listing_role_in_post: "featured_pick" | "included_option" | "best_for_x" | "compared_option" | "itinerary_anchor";
  required_entities: string[];
  required_location_terms: string[];
  required_differentiators: string[];
  outline_sections: Array<{
    heading: string;
    purpose: string;
    must_include_points: string[];
  }>;
  faq_questions: string[];
  internal_link_plan: {
    listing_link_required: true;
    listing_anchor_candidates: string[];
    optional_related_posts: string[];
  };
  rank_math_package: {
    primary_focus_keyword: string;
    seo_title: string;
    meta_description: string;
  };
  quality_checklist: string[];
};

export type Step2InternalState =
  | "not_started"
  | "confirmed_valid"
  | "researching"
  | "brief_ready"
  | "generating"
  | "image_ready"
  | "publishing"
  | "published"
  | "linked"
  | "valid"
  | "needs_review"
  | "failed";

export type Step2UserState = "Already Valid" | "Creating" | "Publishing" | "Published" | "Needs Review" | "Failed";

export type Step2SlotValidationInput = {
  published: boolean;
  linked: boolean;
  metadata_ready: boolean;
  relevant: boolean;
  slot_strong: boolean;
  quality_pass: boolean;
  non_duplicate: boolean;
  step3_consumable: boolean;
};

export type Step2SlotValidationResult = Step2SlotValidationInput & {
  final_state: Step2InternalState;
  counts_toward_required_five: boolean;
};

const IMAGE_EXT = ".jpg";

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const slug = normalized.replace(/\s+/g, "-").replace(/-+/g, "-");
  return slug || "support-guide";
}

export function featuredImageFilenameFromKeyword(focusKeyword: string): string {
  const compact = slugify(focusKeyword).split("-").slice(0, 8).join("-");
  return `${compact}${IMAGE_EXT}`;
}

export function featuredImageAltText(input: { listingTitle: string; focusKeyword: string; slotLabel: string }): string {
  return `${input.slotLabel} guide for ${input.focusKeyword} supporting ${input.listingTitle}`;
}

function inferContentType(title: string): Step2ResearchContentType {
  const t = title.toLowerCase();
  if (/(versus|vs|compare|comparison|alternative)/.test(t)) return "comparison";
  if (/(itinerary|day plan|weekend|route)/.test(t)) return "itinerary";
  if (/(local|near|neighborhood|area|city)/.test(t)) return "local_guide";
  if (/(best|top|roundup|choices)/.test(t)) return "roundup";
  if (/(guide|how to|tips|checklist|faq)/.test(t)) return "informational_guide";
  return "listicle";
}

function dominantFormat(results: Step2ResearchTopResult[]): Step2ResearchContentType {
  const counts = new Map<Step2ResearchContentType, number>();
  for (const item of results) {
    counts.set(item.content_type, (counts.get(item.content_type) ?? 0) + 1);
  }
  return (
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "informational_guide"
  );
}

export function classifySlotAction(slot: Step2MissionPlanSlot): Step2RecommendedAction {
  const existing = Boolean(slot.existing_candidate_post_id || slot.existing_candidate_url || slot.existing_candidate_title);
  if (slot.current_state === "valid" && slot.counts_toward_required_five_now && existing) return "confirm";
  if (slot.current_state === "upgrade_candidate" && existing) return "upgrade";
  return "create";
}

export function buildSupportResearchArtifact(input: {
  slot: Step2MissionPlanSlot;
  listingTitle: string;
  locationCity: string;
  locationRegion: string;
  serpTopResults?: Array<{ title: string; url: string; rank?: number }>;
  competitorHeadings?: string[];
  userQuestions?: string[];
}): Step2SupportResearchArtifact {
  const top_results = (input.serpTopResults ?? []).slice(0, 10).map((item, index) => ({
    title: item.title,
    url: item.url,
    rank: item.rank ?? index + 1,
    content_type: inferContentType(item.title),
  }));

  const contentType = dominantFormat(top_results);
  const queryVariants = Array.from(
    new Set([
      input.slot.recommended_focus_keyword,
      `${input.slot.recommended_focus_keyword} ${input.locationCity}`.trim(),
      `${input.slot.recommended_focus_keyword} ${input.locationRegion}`.trim(),
      ...input.slot.target_query_family,
    ])
  ).filter(Boolean);

  const defaultHeadings = [
    `How to choose ${input.slot.recommended_focus_keyword}`,
    `Best options for ${input.slot.recommended_focus_keyword}`,
    `What matters most for ${input.listingTitle}`,
    "Pricing and trade-offs",
    "Frequently asked questions",
  ];

  const outlinePattern = [
    "Quick answer",
    "Decision criteria",
    "Who this is best for",
    "How this listing fits",
    "FAQ",
  ];

  return {
    slot_id: input.slot.slot_id,
    primary_slot: input.slot.primary_slot,
    focus_keyword: input.slot.recommended_focus_keyword,
    query_variants: queryVariants,
    top_results,
    dominant_format: contentType,
    common_title_patterns: [
      `Best ${input.slot.recommended_focus_keyword} in ${input.locationCity}`.trim(),
      `${input.slot.recommended_focus_keyword}: comparison and buying guide`,
      `${input.slot.recommended_focus_keyword} checklist`,
    ],
    common_headings: (input.competitorHeadings ?? []).slice(0, 8).concat(defaultHeadings).slice(0, 10),
    common_entities: [input.listingTitle, ...input.slot.target_query_family].filter(Boolean).slice(0, 8),
    common_locations: [input.locationCity, input.locationRegion].filter(Boolean),
    common_user_questions: (input.userQuestions ?? []).slice(0, 6),
    common_decision_factors: [
      "service fit",
      "proximity",
      "price transparency",
      "expertise proof",
      "availability",
    ],
    content_gaps_opportunities: [
      "Add stronger local context around selection intent.",
      "Show when this listing is the best fit vs alternatives.",
      "Use concrete proof points, not generic filler.",
    ],
    recommended_winning_angle: input.slot.recommended_angle,
    recommended_title_pattern: `Best ${input.slot.recommended_focus_keyword} for ${input.listingTitle}`,
    recommended_outline_pattern: outlinePattern,
    listing_insertion_strategy:
      "Include the listing as a contextual recommendation with at least one natural in-body internal link.",
    seo_notes: [
      "Primary keyword must appear in title, SEO title, and slug.",
      "Meta description should reflect decision intent without stuffing.",
      "Use one clear featured image filename with keyword intent.",
    ],
  };
}

function listingRole(primarySlot: Step2PrimarySlot): Step2SupportBrief["listing_role_in_post"] {
  if (primarySlot === "best_of") return "featured_pick";
  if (primarySlot === "audience_fit") return "best_for_x";
  if (primarySlot === "comparison") return "compared_option";
  if (primarySlot === "experience_itinerary") return "itinerary_anchor";
  return "included_option";
}

export function buildSupportBrief(input: {
  slot: Step2MissionPlanSlot;
  plan: Step2MissionPlan;
  research: Step2SupportResearchArtifact;
}): Step2SupportBrief {
  const keyword = input.slot.recommended_focus_keyword;
  const articleTitle = input.research.recommended_title_pattern;
  const seoTitle = `${keyword} | ${input.plan.listing_title}`.slice(0, 60);
  const metaDescription = `Decision-support guide for ${keyword} featuring ${input.plan.listing_title}.`.slice(0, 155);
  const slug = slugify(`${keyword}-${input.plan.location_city || input.plan.location_region}`);
  const imageFilename = featuredImageFilenameFromKeyword(keyword);
  const imageAlt = featuredImageAltText({
    listingTitle: input.plan.listing_title,
    focusKeyword: keyword,
    slotLabel: input.slot.slot_label,
  });

  const outlineSections = input.research.recommended_outline_pattern.map((heading) => ({
    heading,
    purpose: `Cover ${heading.toLowerCase()} for ${keyword}.`,
    must_include_points: [
      `Reference ${input.plan.listing_title} naturally.`,
      "Use concrete, non-generic decision support.",
      "Keep slot focus explicit and relevant.",
    ],
  }));

  return {
    slot_id: input.slot.slot_id,
    primary_slot: input.slot.primary_slot,
    focus_keyword: keyword,
    secondary_keywords: input.slot.target_query_family.slice(0, 6),
    post_type: input.research.dominant_format,
    article_title: articleTitle,
    seo_title: seoTitle,
    meta_description: metaDescription,
    slug,
    featured_image_filename: imageFilename,
    featured_image_alt_text: imageAlt,
    recommended_angle: input.research.recommended_winning_angle,
    listing_role_in_post: listingRole(input.slot.primary_slot),
    required_entities: input.plan.core_entities.slice(0, 8),
    required_location_terms: [input.plan.location_city, input.plan.location_area, input.plan.location_region].filter(Boolean),
    required_differentiators: input.plan.differentiators.slice(0, 6),
    outline_sections: outlineSections,
    faq_questions: input.research.common_user_questions,
    internal_link_plan: {
      listing_link_required: true,
      listing_anchor_candidates: [
        input.plan.listing_title,
        `${input.plan.listing_title} ${keyword}`.trim(),
        `${keyword} provider`.trim(),
      ],
      optional_related_posts: [],
    },
    rank_math_package: {
      primary_focus_keyword: keyword,
      seo_title: seoTitle,
      meta_description: metaDescription,
    },
    quality_checklist: [
      "Slot intent is explicit and strong.",
      "Listing materially supports real selection intent.",
      "At least one natural internal link to listing is present.",
      "SEO package is complete and non-stuffed.",
      "Content is non-duplicate and not thin filler.",
    ],
  };
}

export function buildSeoPackageFromBrief(brief: Step2SupportBrief): Step2SeoPackage {
  return {
    primary_focus_keyword: brief.focus_keyword,
    post_title: brief.article_title,
    seo_title: brief.seo_title,
    meta_description: brief.meta_description,
    slug: brief.slug,
    featured_image_filename: brief.featured_image_filename,
    featured_image_alt_text: brief.featured_image_alt_text,
  };
}

export function normalizeSlotValidity(input: Step2SlotValidationInput): Step2SlotValidationResult {
  const publishedButIncomplete = input.published && (!input.linked || !input.metadata_ready || !input.quality_pass);
  const valid =
    input.published &&
    input.linked &&
    input.metadata_ready &&
    input.relevant &&
    input.slot_strong &&
    input.quality_pass &&
    input.non_duplicate &&
    input.step3_consumable;

  let final_state: Step2InternalState = "not_started";
  if (valid) final_state = "valid";
  else if (publishedButIncomplete) final_state = "needs_review";
  else if (input.published) final_state = "published";
  else if (!input.published && input.relevant) final_state = "needs_review";

  return {
    ...input,
    final_state,
    counts_toward_required_five: valid,
  };
}

export function toStep2UserState(state: Step2InternalState): Step2UserState {
  if (state === "confirmed_valid" || state === "valid") return "Already Valid";
  if (state === "not_started" || state === "researching" || state === "brief_ready" || state === "generating" || state === "image_ready") {
    return "Creating";
  }
  if (state === "publishing") return "Publishing";
  if (state === "published" || state === "linked") return "Published";
  if (state === "failed") return "Failed";
  return "Needs Review";
}

export function progressTowardRequiredValid(slots: Array<{ counts_toward_required_five: boolean }>): {
  valid_count: number;
  required_count: number;
  completion_ratio: number;
} {
  const valid_count = slots.filter((item) => item.counts_toward_required_five).length;
  const required_count = REQUIRED_VALID_SUPPORT_COUNT;
  return {
    valid_count,
    required_count,
    completion_ratio: clamp01(valid_count / required_count),
  };
}
