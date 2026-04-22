import { MarketIntelligenceBrief, ThriveIntelligence, WebsiteBrief, WebsiteStrategy } from "@/lib/siteforge/contracts";

function normalizeToken(value: string): string {
  return value.toLowerCase().trim();
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function inferSiteType(brief: WebsiteBrief): WebsiteStrategy["siteType"] {
  const corpus = normalizeToken(`${brief.businessType} ${brief.businessDescription} ${brief.mainOffer}`);
  const appLike = hasAny(corpus, ["app", "saas", "software", "platform", "ios", "android", "mobile"]);
  const serviceLike = hasAny(corpus, ["agency", "service", "consult", "clinic", "practice", "studio"]);
  const productLike = hasAny(corpus, ["product", "device", "shop", "store", "ecommerce"]);

  if ((appLike && serviceLike) || (appLike && productLike) || (serviceLike && productLike)) return "hybrid";
  if (appLike) return "app";
  if (serviceLike) return "service";
  if (productLike) return "product";
  return "service";
}

function inferPrimaryConversionGoal(brief: WebsiteBrief, market: MarketIntelligenceBrief): string {
  if (brief.websiteGoal === "drive_demos_trials") return "start trial or demo";
  if (brief.websiteGoal === "book_calls") return "book qualified call";
  if (brief.websiteGoal === "sell_products") return "complete product purchase";
  if (brief.websiteGoal === "build_authority") return "build trust and capture qualified interest";

  const ctaPatterns = (market.researchIntelligence?.recurringCtaPatterns ?? []).join(" ").toLowerCase();
  if (ctaPatterns.includes("trial")) return "start trial";
  if (ctaPatterns.includes("demo")) return "request demo";
  return "capture qualified leads";
}

function inferTrustModel(market: MarketIntelligenceBrief): string {
  const trust = (market.researchIntelligence?.recurringTrustPatterns ?? []).join(" ").toLowerCase();
  if (trust.includes("testimonial") || trust.includes("social")) return "proof-led with outcomes and operational credibility";
  if (trust.includes("security") || trust.includes("compliance")) return "risk-reduction and reliability-first";
  return "clarity-first trust through concrete workflow details";
}

function pageSetFor(siteType: WebsiteStrategy["siteType"], market: MarketIntelligenceBrief): { requiredPages: string[]; optionalPages: string[] } {
  const recommended = market.researchIntelligence?.recommendedPages ?? [];
  if (recommended.length) {
    const required = recommended.slice(0, 5);
    const optional = recommended.slice(5);
    return { requiredPages: required, optionalPages: optional };
  }

  if (siteType === "app") {
    return {
      requiredPages: ["Home", "Features", "FAQ", "Contact"],
      optionalPages: ["Pricing", "About"],
    };
  }

  if (siteType === "product") {
    return {
      requiredPages: ["Home", "Product", "FAQ", "Contact"],
      optionalPages: ["Pricing", "About"],
    };
  }

  return {
    requiredPages: ["Home", "Services", "About", "Contact"],
    optionalPages: ["FAQ", "Pricing"],
  };
}

function sectionBlueprint(siteType: WebsiteStrategy["siteType"], market: MarketIntelligenceBrief): WebsiteStrategy["homepageStrategy"]["sectionBlueprint"] {
  const patterns = (market.researchIntelligence?.recurringSectionPatterns ?? []).join(" ").toLowerCase();
  if (patterns.includes("faq") && siteType === "app") {
    return ["hero", "problem", "features", "solution", "testimonials", "faq", "cta"];
  }
  if (siteType === "service") {
    return ["hero", "problem", "solution", "features", "testimonials", "cta", "contact"];
  }
  return ["hero", "problem", "solution", "features", "testimonials", "cta"];
}

function keyMessages(brief: WebsiteBrief, market: MarketIntelligenceBrief): string[] {
  const seeds = [
    brief.mainOffer,
    brief.differentiators ?? "",
    ...(market.researchIntelligence?.recurringValueProps ?? []),
    ...(market.researchIntelligence?.differentiationOpportunities ?? []),
  ]
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const unique = new Set<string>();
  const out: string[] = [];
  for (const entry of seeds) {
    const key = entry.toLowerCase();
    if (unique.has(key)) continue;
    unique.add(key);
    out.push(entry);
    if (out.length >= 5) break;
  }

  if (!out.length) {
    return ["Clear value proposition", "Specific workflow outcome", "Strong conversion path"];
  }

  return out;
}

function strategyTone(brief: WebsiteBrief): string {
  if (brief.brandTone === "premium") return "premium and confident";
  if (brief.brandTone === "bold") return "bold and direct";
  if (brief.brandTone === "friendly") return "warm and practical";
  if (brief.brandTone === "modern") return "modern and clear";
  return "expert and clear";
}

function preferredSymbolCategories(siteType: WebsiteStrategy["siteType"]): string[] {
  if (siteType === "app") return ["header", "cta", "faq", "marketing"];
  if (siteType === "product") return ["header", "cta", "marketing", "testimonial"];
  return ["header", "marketing", "testimonial", "cta"];
}

function visualTone(siteType: WebsiteStrategy["siteType"], market: MarketIntelligenceBrief): string {
  const hints = (market.researchIntelligence?.visualDirectionSignals ?? []).join(" ").toLowerCase();
  if (hints.includes("minimal")) return "minimal premium";
  if (siteType === "app") return "modern product-led";
  if (siteType === "service") return "credibility-first editorial";
  return "conversion-focused marketing";
}

export function synthesizeWebsiteStrategy(params: {
  brief: WebsiteBrief;
  marketIntelligence: MarketIntelligenceBrief;
  thriveIntelligence: ThriveIntelligence | null;
}): WebsiteStrategy {
  const siteType = inferSiteType(params.brief);
  const primaryAudience = params.brief.targetAudience.trim() || "high-intent visitors";
  const marketAudience = params.marketIntelligence.researchIntelligence?.audienceSegments ?? [];
  const secondaryAudience = marketAudience.filter((entry) => entry.toLowerCase() !== primaryAudience.toLowerCase()).slice(0, 3);
  const primaryConversionGoal = inferPrimaryConversionGoal(params.brief, params.marketIntelligence);
  const category = params.marketIntelligence.researchIntelligence?.niche || params.brief.businessType;
  const differentiatedPromise =
    params.brief.differentiators?.trim() ||
    params.marketIntelligence.researchIntelligence?.differentiationOpportunities?.[0] ||
    `A clearer way for ${primaryAudience} to achieve results`;

  const primaryCta =
    params.marketIntelligence.researchIntelligence?.recurringCtaPatterns?.find((entry) => entry.toLowerCase().includes("trial"))
      ? "Start free trial"
      : params.brief.websiteGoal === "book_calls"
        ? "Book a call"
        : params.brief.websiteGoal === "sell_products"
          ? "Shop now"
          : "Get started";

  const secondaryCta = siteType === "app" ? "See how it works" : "View pricing";
  const pageStrategy = pageSetFor(siteType, params.marketIntelligence);

  return {
    siteType,
    primaryAudience,
    secondaryAudience,
    primaryConversionGoal,
    positioning: {
      category,
      differentiatedPromise,
      tone: strategyTone(params.brief),
      trustModel: inferTrustModel(params.marketIntelligence),
    },
    homepageStrategy: {
      heroObjective: `Convert ${primaryAudience} with clear differentiated value within first viewport`,
      keyMessages: keyMessages(params.brief, params.marketIntelligence),
      sectionBlueprint: sectionBlueprint(siteType, params.marketIntelligence),
      primaryCta,
      secondaryCta,
    },
    pageStrategy,
    designDirection: {
      visualTone: visualTone(siteType, params.marketIntelligence),
      density: siteType === "app" ? "balanced" : "spacious",
      hierarchyStyle: "hero-first with clear conversion rails",
      proofStyle: "grounded assurance over hype",
      mockupStrategy: siteType === "app" ? "product-visual-first with polished neutral mockups when assets are absent" : "benefit-and-proof-first",
    },
    thriveExecutionHints: {
      preferredShellType: siteType === "app" ? "thrive-homepage-canonical" : "thrive-standard-content",
      preferredSectionPatterns: (params.marketIntelligence.researchIntelligence?.recurringSectionPatterns ?? []).slice(0, 6),
      preferredSymbolCategories: preferredSymbolCategories(siteType),
      prefersLandingPageStyle: siteType === "app" || siteType === "product",
    },
  };
}
