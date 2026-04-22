import { MarketIntelligenceBrief, SitePlan, SitePlanPage, SitePlanSection, WebsiteBrief, WebsiteStrategy } from "@/lib/siteforge/contracts";
import { generateStructuredJson } from "@/lib/siteforge/llm/openai";
import { createId, toSlug } from "@/lib/siteforge/utils";
import { validateSitePlan } from "@/lib/siteforge/agents/validators";

const industryRules: Array<{ match: RegExp; businessType: string; audience: string; goal: string }> = [
  { match: /health|wellness|fitness|therapy|clinic/i, businessType: "Health & Wellness", audience: "health-conscious adults", goal: "book consultations" },
  { match: /ecommerce|shop|store|product|brand/i, businessType: "Ecommerce", audience: "online buyers", goal: "increase purchases" },
  { match: /coach|coaching|consult/i, businessType: "Coaching", audience: "high-intent leads", goal: "book discovery calls" },
  { match: /saas|software|app|platform|b2b/i, businessType: "SaaS", audience: "decision makers", goal: "drive demos and trials" },
];

function createSections(forPage: string, params: { appLike: boolean }): SitePlanSection[] {
  if (forPage === "contact") {
    return [
      { id: createId("sec"), sectionType: "hero", purpose: "Set contact expectations and response window" },
      { id: createId("sec"), sectionType: "contact", purpose: "Collect qualified lead details" },
      { id: createId("sec"), sectionType: "cta", purpose: "Reinforce next action" },
    ];
  }

  if (forPage === "about") {
    return [
      { id: createId("sec"), sectionType: "hero", purpose: "Position brand mission" },
      { id: createId("sec"), sectionType: "solution", purpose: "Explain approach and outcomes" },
      { id: createId("sec"), sectionType: "features", purpose: "Show concrete operational strengths" },
      { id: createId("sec"), sectionType: "cta", purpose: "Move visitor to conversion action" },
    ];
  }

  if (forPage === "home" && params.appLike) {
    return [
      { id: createId("sec"), sectionType: "hero", purpose: "State the value proposition and audience fit clearly" },
      { id: createId("sec"), sectionType: "problem", purpose: "Frame the real workflow pain and stakes" },
      { id: createId("sec"), sectionType: "features", purpose: "Show practical feature pillars derived from the brief" },
      { id: createId("sec"), sectionType: "solution", purpose: "Demonstrate the differentiated product approach" },
      { id: createId("sec"), sectionType: "testimonials", purpose: "Provide neutral trust framing without fabricated testimonials" },
      { id: createId("sec"), sectionType: "faq", purpose: "Answer common adoption and safety concerns" },
      { id: createId("sec"), sectionType: "cta", purpose: "Drive a specific high-intent action" },
    ];
  }

  return [
    { id: createId("sec"), sectionType: "hero", purpose: "Communicate value proposition clearly" },
    { id: createId("sec"), sectionType: "problem", purpose: "Frame the core customer pain" },
    { id: createId("sec"), sectionType: "solution", purpose: "Present the offer" },
    { id: createId("sec"), sectionType: "features", purpose: "Summarize differentiators" },
    { id: createId("sec"), sectionType: "testimonials", purpose: "Build trust with grounded assurance statements" },
    { id: createId("sec"), sectionType: "cta", purpose: "Drive primary conversion action" },
  ];
}

function createPage(title: string, purpose: string, params: { appLike: boolean }): SitePlanPage {
  const slug = toSlug(title === "Home" ? "home" : title);
  return {
    id: createId("page"),
    title,
    slug,
    purpose,
    sections: createSections(slug, params),
  };
}

export function runPlannerAgentDeterministic(prompt: string): SitePlan {
  const rule = industryRules.find((candidate) => candidate.match.test(prompt));
  const businessType = rule?.businessType ?? "Service Business";
  const targetAudience = rule?.audience ?? null;
  const appLike = /saas|software|app|platform|mobile/i.test(prompt);

  const pages = [
    createPage("Home", "Primary conversion page", { appLike }),
    createPage("About", "Trust and credibility page", { appLike }),
    createPage("Contact", "Lead capture and outreach page", { appLike }),
  ];

  return {
    businessType,
    businessSummary: prompt.trim().slice(0, 260) || "Business details to be refined.",
    siteGoal: rule?.goal ?? "capture and convert qualified leads",
    primaryCTA: /book|call|consult/i.test(prompt) ? "Book a Call" : "Get Started",
    targetAudience,
    homepageSlug: "home",
    navigation: pages.map((page) => page.title),
    pages,
    assumptions: [
      "The site should prioritize conversion over blog-heavy structure.",
      "Contact details will be supplied during final launch edits.",
    ],
    warnings: targetAudience ? [] : ["Target audience inferred with low confidence."],
  };
}

const plannerSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "businessType",
    "businessSummary",
    "siteGoal",
    "primaryCTA",
    "targetAudience",
    "homepageSlug",
    "navigation",
    "pages",
    "assumptions",
    "warnings",
  ],
  properties: {
    businessType: { type: "string" },
    businessSummary: { type: "string" },
    siteGoal: { type: "string" },
    primaryCTA: { type: "string" },
    targetAudience: { type: ["string", "null"] },
    homepageSlug: { type: "string" },
    navigation: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    pages: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "slug", "purpose", "sections"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          slug: { type: "string" },
          purpose: { type: "string" },
          sections: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "sectionType", "purpose"],
              properties: {
                id: { type: "string" },
                sectionType: {
                  type: "string",
                  enum: ["hero", "problem", "solution", "features", "testimonials", "cta", "faq", "contact"],
                },
                purpose: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export async function runPlannerAgent(params: {
  brief: WebsiteBrief;
  model: string;
  apiKey: string;
  marketIntelligence?: MarketIntelligenceBrief | null;
  websiteStrategy?: WebsiteStrategy | null;
}): Promise<SitePlan> {
  const prompt = [
    `Business name: ${params.brief.businessName}`,
    `Business type: ${params.brief.businessType}`,
    `Business description: ${params.brief.businessDescription}`,
    `Target audience: ${params.brief.targetAudience}`,
    `Main offer: ${params.brief.mainOffer}`,
    `Website goal: ${params.brief.websiteGoal}`,
    `Brand tone: ${params.brief.brandTone}`,
    params.brief.marketLocation ? `Market: ${params.brief.marketLocation}` : "",
    params.brief.competitors ? `Competitors: ${params.brief.competitors}` : "",
    params.brief.differentiators ? `Differentiators: ${params.brief.differentiators}` : "",
    params.marketIntelligence
      ? `Market intelligence brief: ${JSON.stringify({
          status: params.marketIntelligence.status,
          source: params.marketIntelligence.source,
          commonPageSections: params.marketIntelligence.commonPageSections,
          recurringValueProps: params.marketIntelligence.recurringValueProps,
          trustSignals: params.marketIntelligence.trustSignals,
          ctaPatterns: params.marketIntelligence.ctaPatterns,
          faqThemes: params.marketIntelligence.faqThemes,
          visualPatternHints: params.marketIntelligence.visualPatternHints,
          contentWarnings: params.marketIntelligence.contentWarnings,
        })}`
      : "",
    params.websiteStrategy ? `Website strategy: ${JSON.stringify(params.websiteStrategy)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await generateStructuredJson<unknown>({
    apiKey: params.apiKey,
    model: params.model,
    schemaName: "siteforge_site_plan",
    schema: plannerSchema as unknown as Record<string, unknown>,
    system:
      "You are SiteForge planner agent. Return only valid JSON matching schema. Build a practical conversion-oriented website plan with clear page hierarchy and section order for mobile-first landing pages. Use normalized market patterns when provided. Never copy competitor phrasing verbatim and never propose fabricated testimonials.",
    user:
      `${prompt}\n\nEnsure ids are stable-looking strings and homepage slug corresponds to an existing page.` +
      "\nPrioritize sections with persuasive value and avoid filler or placeholder sections.",
  });

  const validated = validateSitePlan(raw);
  return applyStrategyToPlan({
    plan: validated,
    strategy: params.websiteStrategy ?? null,
    brief: params.brief,
  });
}

function pagePurposeFromTitle(title: string): string {
  const normalized = title.toLowerCase();
  if (normalized === "home") return "Primary conversion page";
  if (normalized.includes("feature")) return "Explain product capability and differentiation";
  if (normalized.includes("service")) return "Explain offer structure and outcomes";
  if (normalized.includes("pricing")) return "Clarify plans and buying path";
  if (normalized.includes("faq")) return "Resolve objections and adoption concerns";
  if (normalized.includes("contact")) return "Capture high-intent outreach";
  if (normalized.includes("about")) return "Build trust and credibility";
  return "Support conversion intent";
}

function toSectionType(
  value: WebsiteStrategy["homepageStrategy"]["sectionBlueprint"][number]
): SitePlanSection["sectionType"] {
  return value;
}

function applyStrategyToPlan(params: {
  plan: SitePlan;
  strategy: WebsiteStrategy | null;
  brief: WebsiteBrief;
}): SitePlan {
  if (!params.strategy) return params.plan;
  const strategy = params.strategy;

  const requiredPages = strategy.pageStrategy.requiredPages.length
    ? strategy.pageStrategy.requiredPages
    : params.plan.pages.map((page) => page.title);

  const nextPages: SitePlanPage[] = requiredPages.map((title, index) => {
    const existing = params.plan.pages.find((page) => page.title.toLowerCase() === title.toLowerCase());
    if (existing) return existing;
    const slug = toSlug(title === "Home" ? "home" : title);
    const sections =
      slug === "home"
        ? strategy.homepageStrategy.sectionBlueprint.map((sectionType) => ({
            id: createId("sec"),
            sectionType: toSectionType(sectionType),
            purpose: `Strategic ${sectionType} section for ${strategy.primaryConversionGoal}`,
          }))
        : createSections(slug, { appLike: strategy.siteType === "app" || strategy.siteType === "hybrid" });
    return {
      id: createId("page"),
      title,
      slug,
      purpose: pagePurposeFromTitle(title),
      sections,
    };
  });

  const homepage = nextPages.find((page) => page.slug === "home") ?? nextPages[0];
  if (homepage) {
    homepage.sections = strategy.homepageStrategy.sectionBlueprint.map((sectionType) => {
      const existing = homepage.sections.find((entry) => entry.sectionType === sectionType);
      return (
        existing ?? {
          id: createId("sec"),
          sectionType: toSectionType(sectionType),
          purpose: `Strategic ${sectionType} section for ${strategy.primaryConversionGoal}`,
        }
      );
    });
  }

  return {
    ...params.plan,
    businessType: params.brief.businessType || params.plan.businessType,
    siteGoal: strategy.primaryConversionGoal || params.plan.siteGoal,
    primaryCTA: strategy.homepageStrategy.primaryCta || params.plan.primaryCTA,
    targetAudience: strategy.primaryAudience || params.plan.targetAudience,
    homepageSlug: homepage?.slug ?? params.plan.homepageSlug,
    navigation: nextPages.map((page) => page.title),
    pages: nextPages,
    assumptions: uniqueAssumptions([
      ...params.plan.assumptions,
      `Strategy siteType: ${strategy.siteType}`,
      `Trust model: ${strategy.positioning.trustModel}`,
    ]),
  };
}

function uniqueAssumptions(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}
