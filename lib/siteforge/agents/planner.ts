import { SitePlan, SitePlanPage, SitePlanSection, WebsiteBrief } from "@/lib/siteforge/contracts";
import { generateStructuredJson } from "@/lib/siteforge/llm/openai";
import { createId, toSlug } from "@/lib/siteforge/utils";
import { validateSitePlan } from "@/lib/siteforge/agents/validators";

const industryRules: Array<{ match: RegExp; businessType: string; audience: string; goal: string }> = [
  { match: /health|wellness|fitness|therapy|clinic/i, businessType: "Health & Wellness", audience: "health-conscious adults", goal: "book consultations" },
  { match: /ecommerce|shop|store|product|brand/i, businessType: "Ecommerce", audience: "online buyers", goal: "increase purchases" },
  { match: /coach|coaching|consult/i, businessType: "Coaching", audience: "high-intent leads", goal: "book discovery calls" },
  { match: /saas|software|app|platform|b2b/i, businessType: "SaaS", audience: "decision makers", goal: "drive demos and trials" },
];

function createSections(forPage: string): SitePlanSection[] {
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
      { id: createId("sec"), sectionType: "testimonials", purpose: "Build trust" },
      { id: createId("sec"), sectionType: "cta", purpose: "Move visitor to conversion action" },
    ];
  }

  return [
    { id: createId("sec"), sectionType: "hero", purpose: "Communicate value proposition clearly" },
    { id: createId("sec"), sectionType: "problem", purpose: "Frame the core customer pain" },
    { id: createId("sec"), sectionType: "solution", purpose: "Present the offer" },
    { id: createId("sec"), sectionType: "features", purpose: "Summarize differentiators" },
    { id: createId("sec"), sectionType: "testimonials", purpose: "Provide social proof" },
    { id: createId("sec"), sectionType: "cta", purpose: "Drive primary conversion action" },
  ];
}

function createPage(title: string, purpose: string): SitePlanPage {
  const slug = toSlug(title === "Home" ? "home" : title);
  return {
    id: createId("page"),
    title,
    slug,
    purpose,
    sections: createSections(slug),
  };
}

export function runPlannerAgentDeterministic(prompt: string): SitePlan {
  const rule = industryRules.find((candidate) => candidate.match.test(prompt));
  const businessType = rule?.businessType ?? "Service Business";
  const targetAudience = rule?.audience ?? null;

  const pages = [
    createPage("Home", "Primary conversion page"),
    createPage("About", "Trust and credibility page"),
    createPage("Contact", "Lead capture and outreach page"),
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
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await generateStructuredJson<unknown>({
    apiKey: params.apiKey,
    model: params.model,
    schemaName: "siteforge_site_plan",
    schema: plannerSchema as unknown as Record<string, unknown>,
    system:
      "You are SiteForge planner agent. Return only valid JSON matching schema. Build a practical conversion-oriented small business website plan.",
    user: `${prompt}\n\nEnsure ids are stable-looking strings and homepage slug corresponds to an existing page.`,
  });

  return validateSitePlan(raw);
}
