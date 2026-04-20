import { createHash } from "node:crypto";
import { MarketIntelligenceBrief, WebsiteBrief } from "@/lib/siteforge/contracts";
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

function baseNotConfigured(): MarketIntelligenceBrief {
  const generatedAt = nowIso();
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
    return baseNotConfigured();
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
      contentWarnings: [
        "serpapi_request_failed",
        error instanceof Error ? error.message : "unknown_error",
      ],
      summary: "Market intelligence attempted but SerpApi requests failed. Planner and content fell back to brief-only context.",
      plannerEnriched: false,
      contentEnriched: false,
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
  };

  return {
    ...payload,
    generatedAt: nowIso(),
    fingerprint: computeFingerprint(payload),
  };
}
