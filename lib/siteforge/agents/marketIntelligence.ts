import { createHash } from "node:crypto";
import { MarketIntelligenceBrief, ResearchIntelligence, WebsiteBrief } from "@/lib/siteforge/contracts";
import { searchSerpApi } from "@/lib/siteforge/serpapi";
import { nowIso } from "@/lib/siteforge/utils";

function unique(values: string[], limit = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function containsAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function inferPattern(textCorpus: string, terms: string[], label: string): string[] {
  return containsAny(textCorpus, terms) ? [label] : [];
}

function extractDomains(links: string[]): string[] {
  return unique(
    links
      .map((link) => {
        try {
          return new URL(link).hostname.replace(/^www\./, "");
        } catch {
          return "";
        }
      })
      .filter(Boolean),
    10
  );
}

function computeFingerprint(payload: Omit<MarketIntelligenceBrief, "fingerprint" | "generatedAt">): string {
  const serialized = JSON.stringify(payload);
  return createHash("sha256").update(serialized).digest("hex").slice(0, 16);
}

function inferNiche(brief: WebsiteBrief, textCorpus: string): string {
  const corpus = `${brief.businessType} ${brief.mainOffer} ${brief.businessDescription} ${textCorpus}`.toLowerCase();
  if (/pet|dog|cat|veterinary|vet/.test(corpus)) return "pet care";
  if (/saas|software|platform|b2b/.test(corpus)) return "software platform";
  if (/clinic|health|wellness|medical/.test(corpus)) return "health and wellness";
  if (/ecommerce|store|shop|product/.test(corpus)) return "product commerce";
  return brief.businessType.trim() || "general business";
}

function inferAudienceSegments(brief: WebsiteBrief, textCorpus: string): string[] {
  const inferred: string[] = [];
  const audience = brief.targetAudience.trim();
  if (audience) inferred.push(audience);
  if (containsAny(textCorpus, ["family", "parents", "caregivers"])) inferred.push("caregivers and families");
  if (containsAny(textCorpus, ["teams", "manager", "operators"])) inferred.push("operational teams");
  if (containsAny(textCorpus, ["founder", "small business", "owners"])) inferred.push("small business owners");
  return unique(inferred, 4);
}

function inferLikelyConversionGoal(brief: WebsiteBrief, ctaPatterns: string[]): string {
  if (brief.websiteGoal === "drive_demos_trials") return "trial_or_demo";
  if (brief.websiteGoal === "book_calls") return "book_call";
  if (brief.websiteGoal === "sell_products") return "purchase";
  if (ctaPatterns.some((entry) => entry.includes("download"))) return "download_app";
  if (ctaPatterns.some((entry) => entry.includes("trial"))) return "start_trial";
  return "capture_lead";
}

function inferRecommendedPages(brief: WebsiteBrief, sectionPatterns: string[], ctaPatterns: string[]): string[] {
  const pages = ["Home"];
  const corpus = `${brief.businessType} ${brief.businessDescription}`.toLowerCase();
  if (/app|saas|software|platform/.test(corpus)) {
    pages.push("Features", "FAQ", "Contact");
    if (ctaPatterns.some((entry) => entry.includes("trial") || entry.includes("demo"))) pages.push("Pricing");
    return unique(pages, 6);
  }

  pages.push("About", "Contact");
  if (sectionPatterns.includes("faq_flow")) pages.push("FAQ");
  if (ctaPatterns.some((entry) => entry.includes("demo") || entry.includes("quote"))) pages.push("Services");
  return unique(pages, 6);
}

function buildResearchIntelligence(params: {
  brief: WebsiteBrief;
  snippets: string[];
  titles: string[];
  links: string[];
  querySet: string[];
  recurringValueProps: string[];
  ctaPatterns: string[];
  trustSignals: string[];
  commonPageSections: string[];
  visualPatternHints: string[];
  status: "used" | "not_configured" | "error";
  source: "serpapi" | "none";
  warnings: string[];
}): ResearchIntelligence {
  const textCorpus = `${params.titles.join(" ")} ${params.snippets.join(" ")}`.toLowerCase();
  const snapshots = params.titles.slice(0, 20).map((title, index) => {
    const link = params.links[index] ?? "";
    let domain = "";
    try {
      domain = link ? new URL(link).hostname.replace(/^www\./, "") : "";
    } catch {
      domain = "";
    }
    return {
      query: params.querySet[index % Math.max(1, params.querySet.length)] ?? "",
      title,
      snippet: params.snippets[index] ?? "",
      link,
      domain,
    };
  });

  const recurringSectionPatterns = unique(
    [
      ...params.commonPageSections,
      ...inferPattern(textCorpus, ["hero", "headline"], "hero_first"),
      ...inferPattern(textCorpus, ["feature", "benefit", "capabilities"], "feature_proof_block"),
      ...inferPattern(textCorpus, ["faq", "questions"], "faq_flow"),
      ...inferPattern(textCorpus, ["cta", "start", "book", "download"], "cta_close"),
    ],
    8
  );

  const recurringTrustPatterns = unique(
    [
      ...params.trustSignals,
      ...inferPattern(textCorpus, ["testimonial", "review", "rating"], "testimonial_led"),
      ...inferPattern(textCorpus, ["trusted by", "customers", "users"], "adoption_signal"),
      ...inferPattern(textCorpus, ["secure", "privacy", "compliance"], "security_signal"),
    ],
    8
  );

  const visualDirectionSignals = unique(
    [
      ...params.visualPatternHints,
      ...inferPattern(textCorpus, ["screenshot", "preview", "demo"], "product_visual_showcase"),
      ...inferPattern(textCorpus, ["clean", "minimal"], "minimal_ui_direction"),
      ...inferPattern(textCorpus, ["premium", "modern"], "premium_modern_aesthetic"),
    ],
    8
  );

  const differentiationOpportunities = unique(
    [
      params.brief.differentiators ?? "",
      ...inferPattern(textCorpus, ["all in one", "single source"], "unified_workflow_promise"),
      ...inferPattern(textCorpus, ["faster", "save time"], "speed_to_outcome"),
      ...inferPattern(textCorpus, ["coordination", "shared"], "multi_stakeholder_coordination"),
    ],
    6
  );

  const recurringCtaPatterns = unique(
    params.ctaPatterns.map((entry) => entry.replace(/_/g, " ")),
    8
  );

  const confidenceNotes = unique(
    [
      params.source === "none" ? "SerpAPI unavailable; strategy confidence reduced and brief-first fallback used." : "SerpAPI patterns included.",
      params.status === "error" ? "SerpAPI request error; using fallback strategic heuristics." : "",
      snapshots.length < 3 ? "Limited external evidence snapshots collected." : "",
      ...params.warnings,
    ],
    6
  );

  return {
    niche: inferNiche(params.brief, textCorpus),
    audienceSegments: inferAudienceSegments(params.brief, textCorpus),
    conversionGoal: inferLikelyConversionGoal(params.brief, params.ctaPatterns),
    recurringValueProps: unique(params.recurringValueProps.map((entry) => entry.replace(/_/g, " ")), 8),
    recurringCtaPatterns,
    recurringTrustPatterns,
    recurringSectionPatterns,
    visualDirectionSignals,
    differentiationOpportunities,
    recommendedPages: inferRecommendedPages(params.brief, recurringSectionPatterns, params.ctaPatterns),
    confidenceNotes,
    sourceSnapshots: snapshots,
  };
}

function baseNotConfigured(brief: WebsiteBrief): MarketIntelligenceBrief {
  const generatedAt = nowIso();
  const researchIntelligence = buildResearchIntelligence({
    brief,
    snippets: [],
    titles: [],
    links: [],
    querySet: [],
    recurringValueProps: [],
    ctaPatterns: [],
    trustSignals: [],
    commonPageSections: [],
    visualPatternHints: [],
    status: "not_configured",
    source: "none",
    warnings: ["serpapi_not_configured", "market_intelligence_skipped"],
  });

  const payload: Omit<MarketIntelligenceBrief, "fingerprint" | "generatedAt"> = {
    status: "not_configured",
    source: "none",
    querySet: [],
    competitorPatterns: [],
    commonPageSections: [],
    recurringValueProps: [],
    trustSignals: [],
    ctaPatterns: [],
    faqThemes: [],
    visualPatternHints: [],
    appStorePositioningHints: [],
    contentWarnings: ["serpapi_not_configured", "market_intelligence_skipped"],
    summary: "Market intelligence skipped because no SerpApi key is configured for this project.",
    plannerEnriched: false,
    contentEnriched: false,
    researchIntelligence,
  };
  return {
    ...payload,
    generatedAt,
    fingerprint: computeFingerprint(payload),
  };
}

function buildQueries(brief: WebsiteBrief): string[] {
  const base = `${brief.businessType} ${brief.mainOffer}`.trim();
  const market = brief.marketLocation?.trim() ? ` ${brief.marketLocation}` : "";
  const competitorHint = brief.competitors?.split(",").map((entry) => entry.trim()).filter(Boolean) ?? [];
  const queries = [
    `${base} alternatives landing page${market}`,
    `${base} app landing page best examples`,
    `${brief.businessType} trust signals testimonials faq`,
    `${brief.businessType} CTA patterns free trial demo`,
    `${brief.businessDescription} feature comparison section`,
    `${brief.mainOffer} app store positioning messaging`,
    ...competitorHint.slice(0, 2).map((name) => `${name} pricing alternatives faq`),
  ];
  return unique(queries, 8);
}

export async function runMarketIntelligenceAgent(params: {
  brief: WebsiteBrief;
  serpApiKey: string | null;
}): Promise<MarketIntelligenceBrief> {
  if (!params.serpApiKey) {
    return baseNotConfigured(params.brief);
  }

  const querySet = buildQueries(params.brief);
  const snippets: string[] = [];
  const titles: string[] = [];
  const links: string[] = [];

  try {
    for (const query of querySet) {
      const results = await searchSerpApi({
        apiKey: params.serpApiKey,
        query,
        location: params.brief.marketLocation,
        num: 6,
      });
      for (const entry of results) {
        titles.push(entry.title);
        snippets.push(entry.snippet);
        links.push(entry.link);
      }
    }
  } catch (error: unknown) {
    const generatedAt = nowIso();
    const researchIntelligence = buildResearchIntelligence({
      brief: params.brief,
      snippets,
      titles,
      links,
      querySet,
      recurringValueProps: [],
      ctaPatterns: [],
      trustSignals: [],
      commonPageSections: [],
      visualPatternHints: [],
      status: "error",
      source: "none",
      warnings: ["serpapi_request_failed", error instanceof Error ? error.message : "unknown_error"],
    });

    const payload: Omit<MarketIntelligenceBrief, "fingerprint" | "generatedAt"> = {
      status: "error",
      source: "serpapi",
      querySet,
      competitorPatterns: [],
      commonPageSections: [],
      recurringValueProps: [],
      trustSignals: [],
      ctaPatterns: [],
      faqThemes: [],
      visualPatternHints: [],
      appStorePositioningHints: [],
      contentWarnings: ["serpapi_request_failed", error instanceof Error ? error.message : "unknown_error"],
      summary: "Market intelligence attempted but SerpApi requests failed. Planner and content fell back to brief-only context.",
      plannerEnriched: false,
      contentEnriched: false,
      researchIntelligence,
    };
    return {
      ...payload,
      generatedAt,
      fingerprint: computeFingerprint(payload),
    };
  }

  const textCorpus = `${titles.join(" ")} ${snippets.join(" ")}`.toLowerCase();
  const domains = extractDomains(links);
  const commonPageSections = unique(
    [
      ...inferPattern(textCorpus, ["hero", "headline", "subheadline"], "hero_section"),
      ...inferPattern(textCorpus, ["feature", "benefit", "capability"], "feature_grid"),
      ...inferPattern(textCorpus, ["testimonial", "review", "customer"], "testimonials"),
      ...inferPattern(textCorpus, ["faq", "questions"], "faq_section"),
      ...inferPattern(textCorpus, ["call to action", "start free", "book demo"], "cta_band"),
      ...inferPattern(textCorpus, ["logos", "trusted by", "compliance"], "trust_strip"),
    ],
    8
  );
  const recurringValueProps = unique(
    [
      ...inferPattern(textCorpus, ["save time", "faster"], "speed_and_convenience"),
      ...inferPattern(textCorpus, ["accuracy", "reliable", "evidence"], "accuracy_and_reliability"),
      ...inferPattern(textCorpus, ["personalized", "tailored"], "personalization"),
      ...inferPattern(textCorpus, ["easy", "simple", "quick setup"], "ease_of_use"),
    ],
    8
  );
  const trustSignals = unique(
    [
      ...inferPattern(textCorpus, ["testimonial", "review", "rating"], "social_proof"),
      ...inferPattern(textCorpus, ["certified", "vet", "expert"], "expert_backing"),
      ...inferPattern(textCorpus, ["secure", "privacy", "gdpr", "hipaa"], "security_privacy"),
      ...inferPattern(textCorpus, ["trusted by", "customers", "users"], "customer_volume"),
    ],
    8
  );
  const ctaPatterns = unique(
    [
      ...inferPattern(textCorpus, ["book demo", "request demo"], "book_demo"),
      ...inferPattern(textCorpus, ["start free", "free trial"], "start_free_trial"),
      ...inferPattern(textCorpus, ["download app", "get app"], "download_app"),
      ...inferPattern(textCorpus, ["get started"], "get_started"),
    ],
    8
  );
  const faqThemes = unique(
    [
      ...inferPattern(textCorpus, ["how does it work", "how it works", "faq"], "how_it_works"),
      ...inferPattern(textCorpus, ["pricing", "cost", "subscription"], "pricing_and_plans"),
      ...inferPattern(textCorpus, ["cancel", "refund"], "cancellation_policy"),
      ...inferPattern(textCorpus, ["safety", "accuracy"], "safety_and_accuracy"),
    ],
    8
  );
  const visualPatternHints = unique(
    [
      ...inferPattern(textCorpus, ["cards", "grid"], "card_grid_layout"),
      ...inferPattern(textCorpus, ["comparison", "vs"], "comparison_band"),
      ...inferPattern(textCorpus, ["screenshot", "preview"], "app_mockup_showcase"),
      ...inferPattern(textCorpus, ["accordion", "toggle"], "faq_toggle"),
    ],
    8
  );
  const appStorePositioningHints = unique(
    [
      ...inferPattern(textCorpus, ["app store", "google play"], "store_presence"),
      ...inferPattern(textCorpus, ["ios", "android"], "cross_platform_availability"),
      ...inferPattern(textCorpus, ["download", "install"], "install_focused_copy"),
    ],
    8
  );

  const researchIntelligence = buildResearchIntelligence({
    brief: params.brief,
    snippets,
    titles,
    links,
    querySet,
    recurringValueProps,
    ctaPatterns,
    trustSignals,
    commonPageSections,
    visualPatternHints,
    status: "used",
    source: "serpapi",
    warnings: ["patterns_only_no_copy"],
  });

  const payload: Omit<MarketIntelligenceBrief, "fingerprint" | "generatedAt"> = {
    status: "used",
    source: "serpapi",
    querySet,
    competitorPatterns: domains,
    commonPageSections,
    recurringValueProps,
    trustSignals,
    ctaPatterns,
    faqThemes,
    visualPatternHints,
    appStorePositioningHints,
    contentWarnings: ["patterns_only_no_copy"],
    summary: `SerpApi patterns extracted from ${querySet.length} query groups. Focus areas: ${unique([...commonPageSections, ...ctaPatterns, ...trustSignals], 5).join(", ") || "conversion structure"}.`,
    plannerEnriched: true,
    contentEnriched: true,
    researchIntelligence,
  };

  return {
    ...payload,
    generatedAt: nowIso(),
    fingerprint: computeFingerprint(payload),
  };
}
