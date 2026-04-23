export type FactConfidence = "confirmed" | "inferred" | "unknown";

export type ListingArchetype =
  | "vacation_rental"
  | "hotel"
  | "restaurant"
  | "local_service"
  | "medical_provider"
  | "legal_provider"
  | "real_estate_agent"
  | "retail_store"
  | "local_attraction"
  | "other_business";

export type ArchetypeClassification = {
  archetype: ListingArchetype;
  confidence: number;
  fallbackReason: string | null;
};

export type ListingFaqContext = {
  listing_id: string;
  site_id: string | null;
  listing_name: string;
  listing_type: string;
  listing_archetype: ListingArchetype;
  category: string;
  subcategory: string;
  city: string;
  region: string;
  neighborhood: string;
  country: string;
  canonical_url: string;
  title: string;
  description: string;
  amenities: string[];
  occupancy: string;
  bedrooms: string;
  bathrooms: string;
  pet_policy: string;
  parking: string;
  wifi: string;
  kitchen: string;
  pool: string;
  hot_tub: string;
  fireplace: string;
  family_friendly: string;
  child_friendly_signals: string[];
  checkin_info: string;
  checkout_info: string;
  cancellation_policy: string;
  booking_rules: string[];
  location_signals: string[];
  nearby_landmarks: string[];
  nearby_activities: string[];
  seasonal_relevance: string[];
  differentiators: string[];
  known_facts: string[];
  inferred_facts: string[];
  unknown_facts: string[];
  fact_confidence_map: Record<string, FactConfidence>;
  support_links: string[];
};

export type ResolvedIntentCluster = {
  cluster_name: string;
  relevance_score: number;
  facts_available_score: number;
  selection_reason: string;
};

export type FaqQuestionCandidate = {
  question_text: string;
  cluster: string;
  listing_specificity_score: number;
  fact_coverage_score: number;
  selection_intent_score: number;
  hallucination_risk_score: number;
  drop_reason: string | null;
};

export type FaqEntry = {
  question: string;
  answer_html: string;
  answer_plaintext: string;
  source_facts: string[];
  fact_confidence: FactConfidence;
  intent_cluster: string;
  listing_anchor_terms: string[];
  local_anchor_terms: string[];
  internal_links: string[];
  quality_score: number;
};

export type FaqQualityScores = {
  listing_specificity: number;
  local_relevance: number;
  directness: number;
  factual_grounding: number;
  selection_intent_coverage: number;
  generic_language_penalty: number;
  hallucination_risk: number;
  answer_completeness: number;
  internal_link_quality: number;
};

export type FaqValidationResult = {
  quality: FaqQualityScores;
  blockedReasons: string[];
  metrics?: {
    duplicate_ratio: number;
    fallback_ratio: number;
    distinct_grounded_facts: number;
    repeated_source_fact_ratio: number;
    repeated_first_sentence_ratio: number;
    unsupported_question_count: number;
  };
};

export type FaqPublishGateResult = {
  allowPublish: boolean;
  reasons: string[];
};

export type ListingFaqEngineResult = {
  context: ListingFaqContext;
  classification: ArchetypeClassification;
  resolved_intent_clusters: ResolvedIntentCluster[];
  candidate_questions: FaqQuestionCandidate[];
  selected_questions: FaqQuestionCandidate[];
  faq_entries: FaqEntry[];
  source_facts: string[];
  fact_confidence_map: Record<string, FactConfidence>;
  quality: FaqQualityScores;
  publish_gate_result: FaqPublishGateResult;
  rendered_html: string;
};
