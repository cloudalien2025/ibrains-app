import { evaluateWalmartListingCompliance } from "@/lib/ecomviper/walmart/walmart-compliance";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

export type WalmartOptimizationStatus =
  | "supported"
  | "partial"
  | "missing"
  | "recommendation_only"
  | "requires_credentials"
  | "requires_walmart_access";

export type WalmartOptimizationPriority = "critical" | "high" | "medium" | "low";
export type WalmartOptimizationImpact = "critical" | "high" | "medium" | "low";

export type WalmartOptimizationApiPushability =
  | "api_supported"
  | "feed_supported"
  | "recommendation_only"
  | "unknown";

export type WalmartOptimizationGroup =
  | "pdp_content"
  | "structured_attributes"
  | "images_media"
  | "rich_media"
  | "faq_optimization"
  | "search_ai_agentic"
  | "compliance_optimization"
  | "listing_quality_performance"
  | "reviews_customer_language"
  | "pricing_fulfillment_offer"
  | "brand_store_graph"
  | "cross_marketplace_consistency"
  | "api_feed_optimization"
  | "analytics_proof";

export type WalmartReadinessGroup =
  | "PDP Content"
  | "Structured Attributes"
  | "Images & Media"
  | "FAQ Coverage"
  | "Compliance Safety"
  | "Search/AI Semantics"
  | "Offer/Fulfillment Signals"
  | "Brand Graph"
  | "Analytics/Proof";

export interface WalmartOptimizationCoverageItem {
  id: string;
  label: string;
  group: WalmartOptimizationGroup;
  status: WalmartOptimizationStatus;
  priority: WalmartOptimizationPriority;
  agenticImpact: WalmartOptimizationImpact;
  apiPushability: WalmartOptimizationApiPushability;
  sourceInCode: string[];
  implementationNotes: string;
}

export interface WalmartAgenticReadinessRecommendation {
  id: string;
  label: string;
  group: WalmartReadinessGroup;
  priority: WalmartOptimizationPriority;
  agenticImpact: WalmartOptimizationImpact;
  status: WalmartOptimizationStatus;
  reason: string;
  nextAction: string;
  apiPushability: WalmartOptimizationApiPushability;
}

export interface WalmartAgenticReadinessScorecard {
  subscores: Record<WalmartReadinessGroup, number>;
  overallAiRecommendationReadinessScore: number;
  aiConfidenceScore: number;
  recommendationProbability: "low" | "medium" | "high";
  missingFieldRecommendations: WalmartAgenticReadinessRecommendation[];
}

export interface WalmartOptimizationCoverageAudit {
  generatedAt: string;
  matrix: WalmartOptimizationCoverageItem[];
  statusCounts: Record<WalmartOptimizationStatus, number>;
  byGroup: Record<WalmartOptimizationGroup, WalmartOptimizationCoverageItem[]>;
  missingFromCode: WalmartOptimizationCoverageItem[];
  nextBestActions: WalmartAgenticReadinessRecommendation[];
  readiness: WalmartAgenticReadinessScorecard;
}

type Row = [
  id: string,
  label: string,
  status?: WalmartOptimizationStatus,
  priority?: WalmartOptimizationPriority,
  impact?: WalmartOptimizationImpact,
  pushability?: WalmartOptimizationApiPushability,
  sourceInCode?: string[],
  note?: string,
];

const SRC = {
  listingQuality: "lib/ecomviper/walmart/walmart-listing-quality.ts",
  compliance: "lib/ecomviper/walmart/walmart-compliance.ts",
  complianceAgent: "lib/ecomviper/walmart/walmart-compliance-agent.ts",
  aiOptimizer: "lib/ecomviper/walmart/walmart-ai-optimizer.ts",
  referralCopy: "lib/ecomviper/walmart/agentic-referral-copy-agent.ts",
  factsAgent: "lib/ecomviper/walmart/product-facts-agent.ts",
  searchBrowseAttributes: "lib/ecomviper/walmart/walmart-search-browse-attributes.ts",
  searchBrowseMapper: "lib/ecomviper/walmart/walmart-search-browse-mapper.ts",
  maintenance: "lib/ecomviper/walmart/walmart-maintenance.ts",
  feeds: "lib/ecomviper/walmart/walmart-feeds.ts",
  pricing: "lib/ecomviper/walmart/walmart-pricing.ts",
  inventory: "lib/ecomviper/walmart/walmart-inventory.ts",
  products: "lib/ecomviper/walmart/walmart-products.ts",
  itemReport: "lib/ecomviper/walmart/walmart-item-report.ts",
  imageProviders: "lib/ecomviper/walmart/walmart-image-providers.ts",
  importEnrichment: "lib/ecomviper/walmart/walmart-import-enrichment.ts",
  reconciliation: "lib/ecomviper/shopify/walmart-shopify-reconciliation.ts",
  dashboard: "app/apps/ecomviper/walmart/page.tsx",
};

const GROUP_DEFAULT_SOURCE: Record<WalmartOptimizationGroup, string[]> = {
  pdp_content: [SRC.listingQuality, SRC.aiOptimizer],
  structured_attributes: [SRC.searchBrowseAttributes, SRC.searchBrowseMapper],
  images_media: [SRC.imageProviders, SRC.importEnrichment],
  rich_media: [SRC.aiOptimizer],
  faq_optimization: [SRC.referralCopy],
  search_ai_agentic: [SRC.referralCopy, SRC.searchBrowseMapper],
  compliance_optimization: [SRC.compliance, SRC.complianceAgent],
  listing_quality_performance: [SRC.listingQuality],
  reviews_customer_language: [SRC.dashboard],
  pricing_fulfillment_offer: [SRC.pricing, SRC.inventory],
  brand_store_graph: [SRC.referralCopy],
  cross_marketplace_consistency: [SRC.reconciliation],
  api_feed_optimization: [SRC.maintenance, SRC.feeds],
  analytics_proof: [SRC.dashboard],
};

function defaultNote(status: WalmartOptimizationStatus): string {
  if (status === "supported") return "Covered in current Walmart lane.";
  if (status === "partial") return "Partially covered; extend deterministic scoring/pathing.";
  if (status === "recommendation_only") return "Available as recommendation-only output; not direct guaranteed push.";
  if (status === "requires_credentials") return "Requires credentials before this capability can execute.";
  if (status === "requires_walmart_access") return "Requires Walmart approval/access scope beyond current runtime.";
  return "Not represented in current code path yet.";
}

function defineGroup(
  group: WalmartOptimizationGroup,
  defaults: {
    status: WalmartOptimizationStatus;
    priority: WalmartOptimizationPriority;
    impact: WalmartOptimizationImpact;
    pushability: WalmartOptimizationApiPushability;
  },
  rows: Row[]
): WalmartOptimizationCoverageItem[] {
  return rows.map((row) => {
    const status = row[2] ?? defaults.status;
    return {
      id: row[0],
      label: row[1],
      group,
      status,
      priority: row[3] ?? defaults.priority,
      agenticImpact: row[4] ?? defaults.impact,
      apiPushability: row[5] ?? defaults.pushability,
      sourceInCode: row[6] ?? (status === "missing" ? [] : GROUP_DEFAULT_SOURCE[group]),
      implementationNotes: row[7] ?? defaultNote(status),
    };
  });
}

const COVERAGE_MATRIX: WalmartOptimizationCoverageItem[] = [
  ...defineGroup(
    "pdp_content",
    { status: "partial", priority: "high", impact: "high", pushability: "api_supported" },
    [
      ["pdp_title", "Product title", "supported", "critical", "critical", "api_supported", [SRC.listingQuality, SRC.aiOptimizer]],
      ["pdp_title_char_count", "Title character count validation", "supported", "high", "high", "api_supported", [SRC.listingQuality, SRC.compliance]],
      ["pdp_title_structure_scoring", "Title structure scoring: brand + product + key attribute + count/size"],
      ["pdp_title_keyword_placement", "Title keyword placement"],
      ["pdp_title_readability", "Title readability"],
      ["pdp_title_uniqueness", "Title uniqueness", "missing"],
      ["pdp_title_capitalization_compliance", "Title capitalization compliance", "supported", "medium", "medium", "api_supported", [SRC.compliance]],
      ["pdp_title_mobile_truncation", "Title mobile truncation awareness"],
      ["pdp_title_ai_readability", "Title AI readability", "partial", "high", "critical", "recommendation_only", [SRC.referralCopy]],
      ["pdp_title_search_intent", "Title search intent match"],
      ["pdp_title_variant_consistency", "Title variant consistency", "missing", "medium", "medium", "unknown"],
      ["pdp_title_product_type_clarity", "Title product type clarity"],
      ["pdp_title_policy_compliance", "Title policy/compliance safety", "supported", "critical", "high", "api_supported", [SRC.compliance, SRC.complianceAgent]],
      ["pdp_short_description", "Short description", "supported", "high", "high", "api_supported", [SRC.aiOptimizer, SRC.maintenance]],
      ["pdp_short_description_semantics", "Short description semantic clarity"],
      ["pdp_short_description_ai_readability", "Short description AI readability"],
      ["pdp_short_description_keyword_relevance", "Short description keyword relevance"],
      ["pdp_short_description_compliance", "Short description compliance safety", "supported", "critical", "high", "api_supported", [SRC.compliance, SRC.complianceAgent]],
      ["pdp_short_description_conversion", "Short description conversion quality", "recommendation_only", "medium", "medium", "recommendation_only"],
      ["pdp_long_description", "Long description", "supported", "critical", "critical", "api_supported", [SRC.aiOptimizer, SRC.maintenance]],
      ["pdp_long_description_min_length", "Long description minimum length validation"],
      ["pdp_long_description_max_length", "Long description maximum/character count validation", "supported", "medium", "medium", "api_supported", [SRC.compliance]],
      ["pdp_long_description_keyword_coverage", "Long description keyword coverage"],
      ["pdp_long_description_semantic_depth", "Long description semantic depth"],
      ["pdp_long_description_conversational_readability", "Long description conversational readability", "recommendation_only", "medium", "high", "recommendation_only"],
      ["pdp_long_description_educational", "Long description educational content"],
      ["pdp_long_description_synonyms", "Long description search synonym coverage", "missing", "medium", "high", "unknown"],
      ["pdp_long_description_ai_comprehension", "Long description AI comprehension", "partial", "high", "critical", "recommendation_only"],
      ["pdp_long_description_question_coverage", "Long description consumer question coverage", "recommendation_only", "medium", "high", "recommendation_only"],
      ["pdp_long_description_ingredient_education", "Long description ingredient education"],
      ["pdp_long_description_benefit_clarity", "Long description benefit clarity"],
      ["pdp_long_description_compliance", "Long description compliance safety", "supported", "critical", "high", "api_supported", [SRC.compliance, SRC.complianceAgent]],
      ["pdp_long_description_structured_format", "Long description structured formatting"],
      ["pdp_long_description_entity_reinforcement", "Long description entity reinforcement", "partial", "high", "critical", "recommendation_only"],
      ["pdp_long_description_use_case", "Long description use-case expansion", "recommendation_only", "medium", "medium", "recommendation_only"],
      ["pdp_long_description_conversion_flow", "Long description conversion flow", "recommendation_only", "low", "medium", "recommendation_only"],
      ["pdp_long_description_trust_language", "Long description trust-building language"],
      ["pdp_bullets", "Key features / bullets", "supported", "critical", "high", "api_supported", [SRC.listingQuality, SRC.aiOptimizer, SRC.maintenance]],
      ["pdp_bullet_count_validation", "Bullet count validation", "supported", "high", "high", "api_supported", [SRC.listingQuality, SRC.compliance]],
      ["pdp_bullet_char_validation", "Bullet character count validation"],
      ["pdp_bullet_order_priority", "Bullet order priority", "missing", "medium", "medium", "unknown"],
      ["pdp_bullet_benefit_clarity", "Bullet benefit clarity"],
      ["pdp_bullet_keyword_placement", "Bullet keyword placement"],
      ["pdp_bullet_search_coverage", "Bullet search coverage"],
      ["pdp_bullet_ai_readability", "Bullet AI readability", "recommendation_only", "medium", "high", "recommendation_only"],
      ["pdp_bullet_compliance", "Bullet compliance safety", "supported", "critical", "high", "api_supported", [SRC.compliance, SRC.complianceAgent]],
      ["pdp_bullet_scannability", "Bullet consumer scannability"],
      ["pdp_bullet_semantic_density", "Bullet semantic density", "missing", "low", "medium", "unknown"],
      ["pdp_bullet_use_case", "Bullet use-case coverage", "recommendation_only", "medium", "medium", "recommendation_only"],
    ]
  ),
  ...defineGroup(
    "structured_attributes",
    { status: "partial", priority: "high", impact: "high", pushability: "api_supported" },
    [
      ["attr_product_type", "Product type"],
      ["attr_product_type_group", "Product type group"],
      ["attr_category_mapping", "Category mapping"],
      ["attr_subcategory_shelf", "Subcategory/shelf placement", "missing", "medium", "medium", "unknown"],
      ["attr_gtin_upc", "GTIN/UPC consistency"],
      ["attr_brand_consistency", "Brand name consistency"],
      ["attr_manufacturer", "Manufacturer name", "supported", "medium", "medium", "api_supported", [SRC.searchBrowseAttributes, SRC.factsAgent]],
      ["attr_country_origin", "Country of origin"],
      ["attr_ingredients", "Ingredients", "supported", "critical", "high", "api_supported", [SRC.searchBrowseAttributes, SRC.factsAgent]],
      ["attr_active_ingredients", "Active ingredients", "supported", "high", "high", "recommendation_only", [SRC.factsAgent, SRC.referralCopy]],
      ["attr_dosage_strength", "Dosage strength"],
      ["attr_serving_size", "Serving size", "supported", "high", "high", "api_supported", [SRC.searchBrowseAttributes, SRC.factsAgent]],
      ["attr_serving_count", "Serving count", "supported", "medium", "medium", "api_supported", [SRC.searchBrowseAttributes, SRC.factsAgent]],
      ["attr_count_per_package", "Count per package", "supported", "medium", "medium", "api_supported", [SRC.searchBrowseAttributes]],
      ["attr_flavor", "Flavor", "supported", "medium", "medium", "api_supported", [SRC.searchBrowseAttributes, SRC.factsAgent]],
      ["attr_scent", "Scent", "missing", "low", "low", "unknown"],
      ["attr_color", "Color"],
      ["attr_size", "Size"],
      ["attr_gender", "Gender", "missing", "low", "low", "unknown"],
      ["attr_age_group", "Age group", "supported", "medium", "medium", "api_supported", [SRC.searchBrowseAttributes]],
      ["attr_health_concern", "Health concern / wellness goal"],
      ["attr_lifestyle", "Lifestyle attributes"],
      ["attr_dietary_flags", "Organic/non-GMO/gluten-free/vegan/kosher/sugar-free/caffeine-free attributes"],
      ["attr_form_factor", "Form factor", "supported", "high", "high", "api_supported", [SRC.searchBrowseAttributes, SRC.factsAgent]],
      ["attr_supplement_type", "Supplement type", "supported", "high", "high", "api_supported", [SRC.searchBrowseAttributes]],
      ["attr_dimensions", "Dimensions", "supported", "medium", "medium", "api_supported", [SRC.searchBrowseAttributes]],
      ["attr_weight", "Weight", "missing", "medium", "medium", "unknown"],
      ["attr_shipping_dimensions", "Shipping dimensions", "missing", "medium", "low", "unknown"],
      ["attr_case_pack", "Case pack attributes", "missing", "low", "low", "unknown"],
      ["attr_compliance_attributes", "Compliance attributes"],
      ["attr_hazmat", "Hazmat attributes", "missing", "medium", "low", "unknown"],
      ["attr_battery", "Battery attributes", "missing", "low", "low", "unknown"],
      ["attr_completeness_score", "Attribute completeness score", "partial", "critical", "high", "recommendation_only", [SRC.listingQuality]],
      ["attr_accuracy_score", "Attribute accuracy score", "missing", "high", "medium", "unknown"],
      ["attr_normalization", "Attribute normalization", "supported", "high", "high", "api_supported", [SRC.searchBrowseAttributes, SRC.searchBrowseMapper]],
      ["attr_semantic_relevance", "Attribute semantic relevance"],
      ["attr_ai_interpretability", "Attribute AI interpretability", "partial", "high", "critical", "recommendation_only"],
      ["attr_marketplace_consistency", "Attribute consistency across marketplace"],
    ]
  ),
  ...defineGroup(
    "images_media",
    { status: "partial", priority: "medium", impact: "medium", pushability: "recommendation_only" },
    [
      ["img_primary_hero", "Primary hero image", "supported", "critical", "critical", "api_supported", [SRC.imageProviders, SRC.importEnrichment, SRC.listingQuality]],
      ["img_white_background", "White background compliance", "recommendation_only", "medium", "medium", "recommendation_only", [SRC.aiOptimizer]],
      ["img_resolution", "Image resolution"],
      ["img_count", "Image count", "partial", "high", "high", "feed_supported"],
      ["img_lifestyle", "Lifestyle images", "supported", "medium", "high", "recommendation_only", [SRC.aiOptimizer]],
      ["img_infographics", "Infographic images", "supported", "medium", "medium", "recommendation_only", [SRC.aiOptimizer]],
      ["img_ingredient_graphics", "Ingredient education graphics", "supported", "medium", "high", "recommendation_only", [SRC.aiOptimizer]],
      ["img_supplement_facts_graphics", "Supplement Facts graphics", "supported", "medium", "medium", "recommendation_only", [SRC.aiOptimizer]],
      ["img_benefit_graphics", "Benefits graphics", "recommendation_only", "medium", "medium", "recommendation_only"],
      ["img_comparison_graphics", "Comparison graphics", "recommendation_only", "low", "medium", "recommendation_only"],
      ["img_size_count_graphics", "Size/count graphics", "recommendation_only", "low", "medium", "recommendation_only"],
      ["img_packaging_consistency", "Packaging consistency"],
      ["img_text_overlay_guidance", "Image text overlay guidance", "partial", "low", "low", "recommendation_only"],
      ["img_ocr_readability", "OCR/readability scoring", "missing", "low", "medium", "unknown"],
      ["img_ai_interpretability", "Image AI interpretability scoring", "missing", "medium", "high", "unknown"],
      ["img_brand_consistency", "Image brand consistency"],
      ["img_trust_signals", "Image trust signals", "recommendation_only", "medium", "medium", "recommendation_only"],
      ["img_ctr_conversion_recos", "Image CTR/conversion recommendation", "recommendation_only", "medium", "high", "recommendation_only"],
      ["img_mobile_readiness", "Mobile image readiness"],
    ]
  ),
  ...defineGroup(
    "rich_media",
    { status: "missing", priority: "medium", impact: "medium", pushability: "unknown" },
    [
      ["rich_videos", "Product videos"],
      ["rich_brand_story", "Brand story modules", "recommendation_only", "low", "medium", "recommendation_only"],
      ["rich_education", "Educational modules", "recommendation_only", "medium", "medium", "recommendation_only"],
      ["rich_ingredient_explanation", "Ingredient explanation modules", "recommendation_only", "medium", "high", "recommendation_only"],
      ["rich_comparison_charts", "Comparison charts"],
      ["rich_usage_demos", "Usage demonstration modules"],
      ["rich_lifestyle_modules", "Lifestyle modules", "recommendation_only", "low", "medium", "recommendation_only"],
      ["rich_embedded_faq", "Embedded FAQ modules", "recommendation_only", "medium", "high", "recommendation_only"],
      ["rich_readiness_score", "Rich media readiness score"],
      ["rich_gap_recos", "Rich media gap recommendations", "partial", "medium", "medium", "recommendation_only"],
      ["rich_labeling_not_pushable", "Clear labeling when rich media is not API-pushable", "supported", "high", "medium", "recommendation_only", [SRC.feeds, SRC.dashboard]],
    ]
  ),
  ...defineGroup(
    "faq_optimization",
    { status: "recommendation_only", priority: "medium", impact: "high", pushability: "recommendation_only" },
    [
      ["faq_quantity", "FAQ quantity", "partial", "high", "high", "recommendation_only", [SRC.referralCopy]],
      ["faq_semantic_coverage", "FAQ semantic coverage"],
      ["faq_search_intent", "FAQ search intent match"],
      ["faq_ai_answer", "FAQ AI answer optimization", "partial", "high", "critical", "recommendation_only", [SRC.referralCopy]],
      ["faq_consumer_education", "FAQ consumer education", "partial", "medium", "high", "recommendation_only", [SRC.referralCopy, SRC.factsAgent]],
      ["faq_ingredient_questions", "FAQ ingredient questions", "partial", "medium", "medium", "recommendation_only", [SRC.referralCopy, SRC.factsAgent]],
      ["faq_use_case_questions", "FAQ use-case questions"],
      ["faq_safety_questions", "FAQ safety questions", "partial", "high", "high", "recommendation_only", [SRC.complianceAgent, SRC.referralCopy]],
      ["faq_daily_use_questions", "FAQ daily-use questions", "partial", "medium", "medium", "recommendation_only", [SRC.referralCopy]],
      ["faq_comparison_questions", "FAQ comparison questions", "missing", "low", "medium", "unknown"],
      ["faq_compliance_safety", "FAQ compliance safety", "partial", "high", "high", "recommendation_only", [SRC.complianceAgent]],
      ["faq_long_tail", "FAQ long-tail query coverage", "missing", "medium", "high", "unknown"],
    ]
  ),
  ...defineGroup(
    "search_ai_agentic",
    { status: "partial", priority: "high", impact: "high", pushability: "recommendation_only" },
    [
      ["search_keyword_clustering", "Keyword clustering", "missing", "medium", "high", "unknown"],
      ["search_primary_keywords", "Primary keyword targeting"],
      ["search_secondary_keywords", "Secondary keyword targeting"],
      ["search_long_tail_keywords", "Long-tail keyword coverage", "missing", "high", "critical", "unknown"],
      ["search_synonyms", "Search synonym expansion", "missing", "high", "high", "unknown"],
      ["search_intent_mapping", "Search intent mapping"],
      ["search_semantic_relevance", "Semantic relevance score", "partial", "high", "critical", "recommendation_only"],
      ["search_entity_reinforcement", "Entity reinforcement", "supported", "high", "critical", "recommendation_only", [SRC.referralCopy, SRC.searchBrowseMapper]],
      ["search_natural_language", "Natural language optimization"],
      ["search_voice_queries", "Voice/conversational query optimization", "missing", "medium", "high", "unknown"],
      ["search_ai_search", "AI search optimization", "partial", "high", "critical", "recommendation_only", [SRC.aiOptimizer, SRC.referralCopy]],
      ["search_agentic_commerce", "Agentic commerce optimization", "supported", "critical", "critical", "recommendation_only", [SRC.referralCopy, SRC.aiOptimizer]],
      ["search_cross_market_semantics", "Cross-marketplace semantic alignment readiness", "partial", "medium", "high", "recommendation_only", [SRC.reconciliation]],
      ["search_ai_readiness_score", "AI Recommendation Readiness Score", "partial", "critical", "critical", "recommendation_only", [SRC.listingQuality]],
      ["search_ai_confidence_score", "AI confidence score", "partial", "high", "critical", "recommendation_only", [SRC.aiOptimizer]],
      ["search_chatgpt_readiness", "ChatGPT referral readiness", "recommendation_only", "high", "critical", "recommendation_only", [SRC.referralCopy]],
      ["search_copilot_readiness", "Copilot referral readiness", "recommendation_only", "medium", "high", "recommendation_only", [SRC.referralCopy]],
      ["search_perplexity_readiness", "Perplexity referral readiness", "recommendation_only", "medium", "high", "recommendation_only", [SRC.referralCopy]],
      ["search_gemini_readiness", "Gemini referral readiness", "recommendation_only", "medium", "high", "recommendation_only", [SRC.referralCopy]],
      ["search_machine_readability", "Machine readability", "supported", "high", "critical", "recommendation_only", [SRC.searchBrowseMapper, SRC.referralCopy]],
      ["search_structured_commerce", "Structured commerce optimization", "partial", "high", "critical", "feed_supported", [SRC.searchBrowseMapper, SRC.maintenance]],
      ["search_recommendation_probability", "Recommendation probability indicators", "partial", "medium", "high", "recommendation_only", [SRC.listingQuality]],
    ]
  ),
  ...defineGroup(
    "compliance_optimization",
    { status: "supported", priority: "high", impact: "high", pushability: "api_supported" },
    [
      ["comp_supplement_claims", "Supplement claim compliance", "supported", "critical", "critical", "api_supported", [SRC.compliance, SRC.complianceAgent]],
      ["comp_fda_disclaimer", "FDA disclaimer presence/placement recommendation", "supported", "critical", "high", "recommendation_only", [SRC.complianceAgent]],
      ["comp_restricted_claims", "Restricted claims removal", "supported", "critical", "high", "api_supported", [SRC.compliance, SRC.complianceAgent]],
      ["comp_drug_claim_prevention", "Drug claim prevention", "supported", "critical", "high", "api_supported", [SRC.compliance, SRC.complianceAgent]],
      ["comp_disease_claim_prevention", "Disease claim prevention", "supported", "critical", "high", "api_supported", [SRC.compliance, SRC.complianceAgent]],
      ["comp_policy_violation_prevention", "Policy violation prevention", "supported", "critical", "high", "api_supported", [SRC.compliance, SRC.complianceAgent]],
      ["comp_trademark_copyright", "Trademark/copyright safety", "missing", "medium", "medium", "unknown"],
      ["comp_ai_generated_safety", "AI-generated content safety", "supported", "high", "high", "recommendation_only", [SRC.complianceAgent, SRC.aiOptimizer]],
      ["comp_walmart_risky_terms", "Walmart prohibited/risky term filtering", "supported", "high", "high", "api_supported", [SRC.compliance, SRC.complianceAgent]],
      ["comp_promo_phrase_removal", "Promotional phrase removal", "supported", "high", "medium", "api_supported", [SRC.compliance]],
      ["comp_competitor_mentions", "Competitor mention removal", "missing", "medium", "medium", "unknown"],
    ]
  ),
  ...defineGroup(
    "listing_quality_performance",
    { status: "partial", priority: "medium", impact: "medium", pushability: "recommendation_only" },
    [
      ["quality_listing_score", "Listing quality score representation", "supported", "critical", "high", "recommendation_only", [SRC.listingQuality]],
      ["quality_content_score", "Content quality score representation"],
      ["quality_offer_score", "Offer score representation"],
      ["quality_price_competitiveness", "Price competitiveness", "missing", "high", "high", "unknown"],
      ["quality_shipping_speed", "Shipping speed", "missing", "medium", "high", "unknown"],
      ["quality_in_stock", "In-stock status", "supported", "critical", "high", "api_supported", [SRC.inventory, SRC.listingQuality]],
      ["quality_rating_review_signal", "Ratings/reviews signal", "requires_walmart_access", "medium", "high", "unknown", []],
      ["quality_return_cancel_risk", "Return/cancellation risk", "requires_walmart_access", "low", "medium", "unknown", []],
      ["quality_before_after", "Before/after score tracking", "partial", "high", "high", "recommendation_only", [SRC.listingQuality]],
      ["quality_improvement_tracking", "Content quality improvement tracking", "partial", "high", "high", "recommendation_only", [SRC.listingQuality]],
    ]
  ),
  ...defineGroup(
    "reviews_customer_language",
    { status: "missing", priority: "medium", impact: "medium", pushability: "unknown" },
    [
      ["reviews_quantity", "Review quantity", "requires_walmart_access", "medium", "high", "unknown", []],
      ["reviews_velocity", "Review velocity", "requires_walmart_access", "low", "medium", "unknown", []],
      ["reviews_sentiment", "Review sentiment"],
      ["reviews_keyword_mining", "Review keyword mining"],
      ["reviews_faq_mining", "Review FAQ mining"],
      ["reviews_use_case_mining", "Review use-case mining", "missing", "low", "medium", "unknown"],
      ["reviews_semantic_reinforcement", "Review semantic reinforcement", "missing", "low", "medium", "unknown"],
      ["reviews_trust_signals", "Review trust-signal extraction"],
      ["reviews_placeholder_state", "Placeholder/recommendation states when review data is unavailable", "supported", "high", "medium", "recommendation_only", [SRC.dashboard]],
    ]
  ),
  ...defineGroup(
    "pricing_fulfillment_offer",
    { status: "missing", priority: "medium", impact: "medium", pushability: "unknown" },
    [
      ["offer_price_matching", "Competitive price matching"],
      ["offer_price_parity", "Price parity"],
      ["offer_sale_price_readiness", "Sale/promotional pricing readiness", "partial", "medium", "medium", "feed_supported", [SRC.pricing, SRC.maintenance]],
      ["offer_margin_awareness", "Margin/profit awareness", "missing", "low", "medium", "unknown"],
      ["offer_wfs_eligibility", "WFS eligibility", "requires_walmart_access", "medium", "high", "unknown", []],
      ["offer_two_day_eligibility", "2-day shipping eligibility", "requires_walmart_access", "medium", "high", "unknown", []],
      ["offer_delivery_speed", "Delivery speed", "requires_walmart_access", "medium", "high", "unknown", []],
      ["offer_shipping_badge", "Shipping badge readiness", "requires_walmart_access", "low", "medium", "unknown", []],
      ["offer_inventory_availability", "Inventory availability", "supported", "critical", "high", "api_supported", [SRC.inventory, SRC.listingQuality]],
      ["offer_oos_prevention", "Out-of-stock prevention", "partial", "high", "high", "recommendation_only", [SRC.inventory, SRC.listingQuality]],
    ]
  ),
  ...defineGroup(
    "brand_store_graph",
    { status: "missing", priority: "low", impact: "medium", pushability: "unknown" },
    [
      ["brand_store_structure", "Brand store structure"],
      ["brand_category_hubs", "Brand category hubs", "missing", "low", "low", "unknown"],
      ["brand_educational_content", "Brand educational content", "recommendation_only", "low", "medium", "recommendation_only", [SRC.referralCopy]],
      ["brand_semantic_authority", "Brand semantic authority", "partial", "medium", "high", "recommendation_only", [SRC.referralCopy, SRC.factsAgent]],
      ["brand_storytelling", "Brand storytelling", "recommendation_only", "low", "medium", "recommendation_only", [SRC.referralCopy]],
      ["brand_collection_org", "Brand collection organization", "missing", "low", "low", "unknown"],
      ["brand_cross_sell", "Cross-selling structure", "missing", "medium", "medium", "unknown"],
      ["brand_faq_ecosystem", "Brand FAQ ecosystem", "recommendation_only", "low", "medium", "recommendation_only", [SRC.referralCopy]],
      ["brand_trust_reinforcement", "Brand trust reinforcement", "partial", "medium", "high", "recommendation_only", [SRC.referralCopy, SRC.complianceAgent]],
      ["brand_ai_readability", "Brand AI readability", "partial", "medium", "high", "recommendation_only", [SRC.referralCopy]],
      ["brand_catalog_semantic_consistency", "Catalog-level semantic consistency", "partial", "medium", "high", "recommendation_only", [SRC.reconciliation]],
    ]
  ),
  ...defineGroup(
    "cross_marketplace_consistency",
    { status: "missing", priority: "medium", impact: "medium", pushability: "unknown" },
    [
      ["cross_shopify_walmart", "Shopify-Walmart consistency readiness", "supported", "high", "high", "recommendation_only", [SRC.reconciliation]],
      ["cross_ebay_walmart", "eBay-Walmart consistency readiness"],
      ["cross_amazon_walmart", "Amazon-Walmart consistency readiness"],
      ["cross_brand_voice", "Brand voice consistency", "partial", "medium", "medium", "recommendation_only", [SRC.referralCopy]],
      ["cross_attribute_consistency", "Attribute consistency", "partial", "medium", "high", "recommendation_only", [SRC.reconciliation]],
      ["cross_image_consistency", "Image consistency", "partial", "medium", "medium", "recommendation_only", [SRC.reconciliation, SRC.importEnrichment]],
      ["cross_faq_consistency", "FAQ consistency", "missing", "low", "medium", "unknown"],
      ["cross_entity_consistency", "Entity consistency", "partial", "medium", "high", "recommendation_only", [SRC.factsAgent, SRC.reconciliation]],
      ["cross_trust_signals", "Cross-platform trust signals", "missing", "low", "medium", "unknown"],
    ]
  ),
  ...defineGroup(
    "api_feed_optimization",
    { status: "partial", priority: "medium", impact: "medium", pushability: "feed_supported" },
    [
      ["feed_mp_maintenance", "MP_MAINTENANCE payload readiness", "supported", "critical", "high", "feed_supported", [SRC.maintenance, SRC.feeds]],
      ["feed_bulk_optimization", "Bulk feed optimization"],
      ["feed_payload_preview", "JSON payload preview", "supported", "high", "medium", "feed_supported", [SRC.maintenance]],
      ["feed_validation_prevention", "Feed validation error prevention"],
      ["feed_attribute_completeness", "Feed attribute completeness", "partial", "high", "high", "feed_supported", [SRC.searchBrowseMapper, SRC.listingQuality]],
      ["feed_sync_consistency", "Feed sync consistency"],
      ["feed_automated_update", "Automated listing update path", "partial", "high", "high", "feed_supported", [SRC.maintenance, SRC.feeds]],
      ["feed_automated_mapping", "Automated attribute mapping", "supported", "high", "high", "feed_supported", [SRC.searchBrowseMapper, SRC.factsAgent]],
      ["feed_automated_compliance_scan", "Automated compliance scanning", "supported", "critical", "high", "feed_supported", [SRC.compliance, SRC.complianceAgent]],
      ["feed_automated_seo", "Automated SEO generation", "partial", "medium", "high", "recommendation_only", [SRC.referralCopy]],
      ["feed_automated_faq", "Automated FAQ generation", "supported", "medium", "high", "recommendation_only", [SRC.referralCopy]],
      ["feed_automated_image_recos", "Automated image assignment recommendations", "supported", "high", "medium", "recommendation_only", [SRC.importEnrichment, SRC.listingQuality]],
      ["feed_automated_rich_media_recos", "Automated rich media readiness recommendations", "missing", "low", "medium", "recommendation_only"],
      ["feed_automated_listing_scoring", "Automated listing scoring", "supported", "high", "high", "recommendation_only", [SRC.listingQuality]],
    ]
  ),
  ...defineGroup(
    "analytics_proof",
    { status: "missing", priority: "medium", impact: "high", pushability: "unknown" },
    [
      ["analytics_impressions", "Impression tracking", "requires_walmart_access", "medium", "high", "unknown", []],
      ["analytics_ctr", "CTR tracking", "requires_walmart_access", "medium", "high", "unknown", []],
      ["analytics_conversion", "Conversion tracking", "requires_walmart_access", "high", "high", "unknown", []],
      ["analytics_search_visibility", "Search visibility tracking", "missing", "high", "critical", "unknown"],
      ["analytics_keyword_rank", "Keyword ranking tracking", "missing", "high", "critical", "unknown"],
      ["analytics_ai_referrals", "AI referral tracking", "missing", "high", "critical", "unknown"],
      ["analytics_chatgpt_attr", "ChatGPT referral attribution", "missing", "high", "critical", "unknown"],
      ["analytics_copilot_attr", "Copilot referral attribution", "missing", "medium", "high", "unknown"],
      ["analytics_perplexity_attr", "Perplexity referral attribution", "missing", "medium", "high", "unknown"],
      ["analytics_marketplace_traffic", "Marketplace traffic attribution", "requires_walmart_access", "medium", "high", "unknown", []],
      ["analytics_listing_score", "Listing score tracking", "partial", "high", "high", "recommendation_only", [SRC.listingQuality]],
      ["analytics_competitor_benchmark", "Competitor benchmark tracking", "missing", "medium", "medium", "unknown"],
      ["analytics_before_after", "Before/after optimization tracking", "partial", "high", "high", "recommendation_only", [SRC.listingQuality]],
      ["analytics_content_improvement", "Content quality improvement tracking", "partial", "high", "high", "recommendation_only", [SRC.listingQuality]],
    ]
  ),
];

const GROUP_TO_READINESS: Record<WalmartOptimizationGroup, WalmartReadinessGroup> = {
  pdp_content: "PDP Content",
  structured_attributes: "Structured Attributes",
  images_media: "Images & Media",
  rich_media: "Images & Media",
  faq_optimization: "FAQ Coverage",
  search_ai_agentic: "Search/AI Semantics",
  compliance_optimization: "Compliance Safety",
  listing_quality_performance: "Offer/Fulfillment Signals",
  reviews_customer_language: "Analytics/Proof",
  pricing_fulfillment_offer: "Offer/Fulfillment Signals",
  brand_store_graph: "Brand Graph",
  cross_marketplace_consistency: "Brand Graph",
  api_feed_optimization: "Search/AI Semantics",
  analytics_proof: "Analytics/Proof",
};

const READINESS_GROUPS: WalmartReadinessGroup[] = [
  "PDP Content",
  "Structured Attributes",
  "Images & Media",
  "FAQ Coverage",
  "Compliance Safety",
  "Search/AI Semantics",
  "Offer/Fulfillment Signals",
  "Brand Graph",
  "Analytics/Proof",
];

const STATUS_SCORE: Record<WalmartOptimizationStatus, number> = {
  supported: 100,
  partial: 72,
  recommendation_only: 52,
  requires_credentials: 42,
  requires_walmart_access: 34,
  missing: 18,
};

const IMPACT_RANK: Record<WalmartOptimizationImpact, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_RANK: Record<WalmartOptimizationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sortByPriorityAndImpact<T extends { priority: WalmartOptimizationPriority; agenticImpact: WalmartOptimizationImpact }>(
  items: T[]
): T[] {
  return [...items].sort((left, right) => {
    const impact = IMPACT_RANK[left.agenticImpact] - IMPACT_RANK[right.agenticImpact];
    if (impact !== 0) return impact;
    return PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
  });
}

function extractAttrs(product: WalmartProductRecord): Record<string, string> {
  return {
    ...(product.attributes ?? {}),
    ...(product.searchBrowseAttributes ?? {}),
  };
}

function extractFaqCount(product: WalmartProductRecord): number {
  const attrs = extractAttrs(product);
  const fromAttr = [attrs.faq, attrs.faqs, attrs.faq_snippets]
    .map((entry) => asString(entry))
    .filter(Boolean)
    .join("\n");

  const payloads = [asObject(product.normalizedPayload), asObject(product.rawPayload)].filter(
    (entry): entry is Record<string, unknown> => entry !== null
  );

  const fromPayload = payloads.flatMap((entry) => {
    const list = entry.faqSnippets;
    if (Array.isArray(list)) return list.map((row) => asString(row)).filter(Boolean);
    const text = asString(entry.faqSnippets ?? entry.faq ?? entry.faqs);
    return text ? text.split(/\r?\n|[;|]+/).map((row) => row.trim()).filter(Boolean) : [];
  });

  const merged = [
    ...fromAttr.split(/\r?\n|[;|]+/).map((row) => row.trim()).filter(Boolean),
    ...fromPayload,
  ];

  return new Set(merged).size;
}

function metricPresent(product: WalmartProductRecord, keys: string[]): boolean {
  const payloads = [asObject(product.normalizedPayload), asObject(product.rawPayload)].filter(
    (entry): entry is Record<string, unknown> => entry !== null
  );

  for (const payload of payloads) {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === "number" && Number.isFinite(value)) return true;
      if (typeof value === "string" && value.trim().length > 0) return true;
    }
  }
  return false;
}

function scoreDataForProduct(product: WalmartProductRecord): {
  scores: Record<WalmartReadinessGroup, number>;
  recommendations: WalmartAgenticReadinessRecommendation[];
} {
  const attrs = extractAttrs(product);
  const recommendations: WalmartAgenticReadinessRecommendation[] = [];

  const title = product.title.trim();
  const shortDescription = product.shortDescription.trim();
  const longDescription = product.longDescription.trim();
  const bulletCount = product.bulletPoints.filter((entry) => entry.trim().length > 0).length;

  let pdp = 0;
  if (title.length >= 40 && title.length <= 180) pdp += 30;
  else pdp += title ? 12 : 0;
  if (shortDescription.length >= 40) pdp += 15;
  if (longDescription.length >= 220) pdp += 25;
  else if (longDescription.length >= 80) pdp += 10;
  if (bulletCount >= 4) pdp += 20;
  else if (bulletCount >= 3) pdp += 12;
  if (product.brand && title.toLowerCase().includes(product.brand.toLowerCase())) pdp += 10;
  if (pdp < 65) {
    recommendations.push({
      id: "rec_pdp_depth",
      label: "Improve PDP content depth",
      group: "PDP Content",
      priority: "high",
      agenticImpact: "high",
      status: "partial",
      reason: "Title/description/bullet coverage is below strong readiness thresholds.",
      nextAction: "Expand title clarity, long description depth, and 3-5 compliant bullets.",
      apiPushability: "api_supported",
    });
  }

  const attrKeys = [
    "brand",
    "supplement_type",
    "product_form",
    "main_ingredients",
    "serving_size",
    "servings_per_container",
    "count",
    "target_audience",
    "age_group",
    "support_areas",
  ];
  const attrPresent = attrKeys.filter((key) => asString(attrs[key]).length > 0).length;
  const attrScore = clamp((attrPresent / attrKeys.length) * 100);
  if (attrPresent < 7) {
    recommendations.push({
      id: "rec_attr_fill",
      label: "Fill missing structured attributes",
      group: "Structured Attributes",
      priority: "critical",
      agenticImpact: "high",
      status: "partial",
      reason: `Only ${attrPresent}/${attrKeys.length} core structured fields are populated.`,
      nextAction: "Populate supplement type, form, ingredients, serving, audience, and support fields.",
      apiPushability: "api_supported",
    });
  }

  const galleryCount = (product.galleryImageUrls ?? []).filter((entry) => entry.trim().length > 0).length;
  let imageScore = 0;
  if (product.imageUrl.trim()) imageScore += 45;
  if (galleryCount >= 4) imageScore += 25;
  else if (galleryCount >= 2) imageScore += 15;
  if ((product.generatedMediaAssets ?? []).length > 0) imageScore += 15;
  if ((product.altText?.trim().length ?? 0) >= 16) imageScore += 15;
  if (!product.imageUrl.trim()) {
    recommendations.push({
      id: "rec_image_primary",
      label: "Resolve primary image",
      group: "Images & Media",
      priority: "critical",
      agenticImpact: "critical",
      status: "missing",
      reason: "Primary hero image is missing.",
      nextAction: "Run enrichment or upload a compliant primary image.",
      apiPushability: "api_supported",
    });
  }

  const faqCount = extractFaqCount(product);
  const faqScore = faqCount >= 6 ? 100 : faqCount >= 4 ? 80 : faqCount >= 2 ? 55 : 20;
  if (faqCount < 4) {
    recommendations.push({
      id: "rec_faq_expand",
      label: "Expand FAQ coverage",
      group: "FAQ Coverage",
      priority: "high",
      agenticImpact: "high",
      status: "partial",
      reason: "FAQ coverage is light for answer-engine retrieval.",
      nextAction: "Add 4-6 FAQs across safety, use, ingredients, and fit.",
      apiPushability: "recommendation_only",
    });
  }

  const compliance = evaluateWalmartListingCompliance({
    title: product.title,
    shortDescription: product.shortDescription,
    longDescription: product.longDescription,
    bulletPoints: product.bulletPoints,
  });
  const complianceScore = clamp((compliance.valid ? 90 : 45) - compliance.violations.length * 10 - compliance.warnings.length * 2);
  if (compliance.violations.length > 0) {
    recommendations.push({
      id: "rec_compliance",
      label: "Resolve compliance blockers",
      group: "Compliance Safety",
      priority: "critical",
      agenticImpact: "high",
      status: "partial",
      reason: compliance.violations.slice(0, 2).join(" "),
      nextAction: "Remove risky medical/drug claims and promotional terms before submission.",
      apiPushability: "api_supported",
    });
  }

  const searchSignals = ["support_areas", "main_ingredients", "target_audience", "search_terms", "search_keywords"];
  const searchCount = searchSignals.filter((key) => asString(attrs[key]).length > 0).length;
  const searchScore = clamp((searchCount / searchSignals.length) * 80 + 20);
  if (searchCount < 3) {
    recommendations.push({
      id: "rec_search_signals",
      label: "Strengthen search/AI semantic signals",
      group: "Search/AI Semantics",
      priority: "high",
      agenticImpact: "critical",
      status: "partial",
      reason: "Search semantics are under-populated.",
      nextAction: "Add support areas, ingredient keywords, and search terms for intent coverage.",
      apiPushability: "api_supported",
    });
  }

  let offerScore = 0;
  if (Number.isFinite(product.price) && product.price > 0) offerScore += 40;
  if (product.inventoryStatus === "known") offerScore += 30;
  if (product.inventoryStatus === "known" && product.inventoryQuantity > 0) offerScore += 30;
  if (offerScore < 60) {
    recommendations.push({
      id: "rec_offer_basics",
      label: "Stabilize offer fundamentals",
      group: "Offer/Fulfillment Signals",
      priority: "high",
      agenticImpact: "high",
      status: "partial",
      reason: "Price/inventory health is weak or incomplete.",
      nextAction: "Set valid price and sync in-stock inventory before optimization push.",
      apiPushability: "api_supported",
    });
  }

  let brandScore = 0;
  if (product.brand.trim()) brandScore += 40;
  if (product.category.trim()) brandScore += 25;
  if (asString(attrs.manufacturer)) brandScore += 15;
  if (asString(attrs.target_audience)) brandScore += 10;
  if (asString(attrs.support_areas)) brandScore += 10;
  if (brandScore < 60) {
    recommendations.push({
      id: "rec_brand_graph",
      label: "Reinforce brand graph signals",
      group: "Brand Graph",
      priority: "medium",
      agenticImpact: "high",
      status: "partial",
      reason: "Brand semantic authority fields are incomplete.",
      nextAction: "Populate brand/manufacturer/audience/support entities for stronger machine linking.",
      apiPushability: "recommendation_only",
    });
  }

  let analyticsScore = 0;
  if (metricPresent(product, ["impressions", "impressionCount"])) analyticsScore += 25;
  if (metricPresent(product, ["ctr", "clickThroughRate"])) analyticsScore += 25;
  if (metricPresent(product, ["conversionRate", "conversions"])) analyticsScore += 25;
  if (metricPresent(product, ["beforeScore", "afterScore", "optimizationDelta"])) analyticsScore += 25;
  if (analyticsScore < 50) {
    recommendations.push({
      id: "rec_analytics_proof",
      label: "Add proof telemetry",
      group: "Analytics/Proof",
      priority: "high",
      agenticImpact: "critical",
      status: "missing",
      reason: "Limited impressions/CTR/conversion/before-after evidence available.",
      nextAction: "Wire telemetry capture and persist score deltas for optimization proof.",
      apiPushability: "recommendation_only",
    });
  }

  return {
    scores: {
      "PDP Content": clamp(pdp),
      "Structured Attributes": attrScore,
      "Images & Media": clamp(imageScore),
      "FAQ Coverage": clamp(faqScore),
      "Compliance Safety": complianceScore,
      "Search/AI Semantics": searchScore,
      "Offer/Fulfillment Signals": clamp(offerScore),
      "Brand Graph": clamp(brandScore),
      "Analytics/Proof": clamp(analyticsScore),
    },
    recommendations,
  };
}

function coverageSubscores(matrix: WalmartOptimizationCoverageItem[]): Record<WalmartReadinessGroup, number> {
  const grouped: Record<WalmartReadinessGroup, number[]> = {
    "PDP Content": [],
    "Structured Attributes": [],
    "Images & Media": [],
    "FAQ Coverage": [],
    "Compliance Safety": [],
    "Search/AI Semantics": [],
    "Offer/Fulfillment Signals": [],
    "Brand Graph": [],
    "Analytics/Proof": [],
  };

  for (const row of matrix) grouped[GROUP_TO_READINESS[row.group]].push(STATUS_SCORE[row.status]);

  const output = {} as Record<WalmartReadinessGroup, number>;
  for (const group of READINESS_GROUPS) {
    const values = grouped[group];
    output[group] = values.length ? clamp(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  }
  return output;
}

function convertGapToRecommendation(item: WalmartOptimizationCoverageItem): WalmartAgenticReadinessRecommendation {
  return {
    id: `coverage_${item.id}`,
    label: item.label,
    group: GROUP_TO_READINESS[item.group],
    priority: item.priority,
    agenticImpact: item.agenticImpact,
    status: item.status,
    reason: item.implementationNotes,
    nextAction:
      item.status === "requires_credentials"
        ? "Connect required credentials and rerun readiness checks."
        : item.status === "requires_walmart_access"
        ? "Request required Walmart access/approval and map the field path safely."
        : item.status === "recommendation_only"
        ? "Keep recommendation output and expose clearly as non-pushable until support exists."
        : item.status === "partial"
        ? "Extend current implementation with deterministic scoring/validation for this area."
        : "Add typed MVP support path with safe recommendation fallback.",
    apiPushability: item.apiPushability,
  };
}

export function getWalmartOptimizationCoverageMatrix(): WalmartOptimizationCoverageItem[] {
  return COVERAGE_MATRIX.map((entry) => ({ ...entry, sourceInCode: [...entry.sourceInCode] }));
}

export function buildWalmartAgenticReadinessScorecard(input?: {
  product?: WalmartProductRecord | null;
  matrix?: WalmartOptimizationCoverageItem[];
}): WalmartAgenticReadinessScorecard {
  const matrix = input?.matrix ?? getWalmartOptimizationCoverageMatrix();
  const coverage = coverageSubscores(matrix);
  const perProduct = input?.product ? scoreDataForProduct(input.product) : null;

  const subscores = {} as Record<WalmartReadinessGroup, number>;
  for (const group of READINESS_GROUPS) {
    const coverageScore = coverage[group];
    const productScore = perProduct?.scores[group];
    subscores[group] = productScore === undefined ? coverageScore : clamp(coverageScore * 0.6 + productScore * 0.4);
  }

  const overall = clamp(READINESS_GROUPS.reduce((sum, group) => sum + subscores[group], 0) / READINESS_GROUPS.length);
  const aiConfidenceScore = clamp(
    overall * 0.65 +
      subscores["Search/AI Semantics"] * 0.2 +
      subscores["Structured Attributes"] * 0.1 +
      subscores["Compliance Safety"] * 0.05
  );

  const recommendationProbability: "low" | "medium" | "high" =
    overall >= 80 && aiConfidenceScore >= 78
      ? "high"
      : overall >= 60 && aiConfidenceScore >= 58
      ? "medium"
      : "low";

  const coverageRecs = sortByPriorityAndImpact(
    matrix
      .filter((row) => row.status !== "supported")
      .map((row) => convertGapToRecommendation(row))
  ).slice(0, 14);

  const missingFieldRecommendations = sortByPriorityAndImpact([
    ...(perProduct?.recommendations ?? []),
    ...coverageRecs,
  ]).slice(0, 20);

  return {
    subscores,
    overallAiRecommendationReadinessScore: overall,
    aiConfidenceScore,
    recommendationProbability,
    missingFieldRecommendations,
  };
}

export function buildWalmartOptimizationCoverageAudit(input?: {
  product?: WalmartProductRecord | null;
}): WalmartOptimizationCoverageAudit {
  const matrix = getWalmartOptimizationCoverageMatrix();
  const readiness = buildWalmartAgenticReadinessScorecard({
    product: input?.product ?? null,
    matrix,
  });

  const statusCounts: Record<WalmartOptimizationStatus, number> = {
    supported: 0,
    partial: 0,
    missing: 0,
    recommendation_only: 0,
    requires_credentials: 0,
    requires_walmart_access: 0,
  };

  const byGroup = {
    pdp_content: [],
    structured_attributes: [],
    images_media: [],
    rich_media: [],
    faq_optimization: [],
    search_ai_agentic: [],
    compliance_optimization: [],
    listing_quality_performance: [],
    reviews_customer_language: [],
    pricing_fulfillment_offer: [],
    brand_store_graph: [],
    cross_marketplace_consistency: [],
    api_feed_optimization: [],
    analytics_proof: [],
  } as Record<WalmartOptimizationGroup, WalmartOptimizationCoverageItem[]>;

  for (const row of matrix) {
    statusCounts[row.status] += 1;
    byGroup[row.group].push(row);
  }

  const missingFromCode = sortByPriorityAndImpact(
    matrix.filter((row) => row.status === "missing" || row.status === "partial")
  );

  const nextBestActions = sortByPriorityAndImpact(readiness.missingFieldRecommendations).slice(0, 12);

  return {
    generatedAt: new Date().toISOString(),
    matrix,
    statusCounts,
    byGroup,
    missingFromCode,
    nextBestActions,
    readiness,
  };
}
