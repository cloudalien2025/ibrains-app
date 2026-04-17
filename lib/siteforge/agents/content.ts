import { ContentPackage, ContentPageContent, SitePlan, WebsiteBrief } from "@/lib/siteforge/contracts";
import { validateContentPackage } from "@/lib/siteforge/agents/validators";
import { generateStructuredJson } from "@/lib/siteforge/llm/openai";

function sectionHeading(sectionType: string, title: string): string {
  switch (sectionType) {
    case "hero":
      return `${title} That Converts`;
    case "problem":
      return "Why Most Options Fall Short";
    case "solution":
      return "How We Deliver Better Outcomes";
    case "features":
      return "What You Get";
    case "testimonials":
      return "Trusted by Clients";
    case "cta":
      return "Ready to Take the Next Step?";
    case "faq":
      return "Frequently Asked Questions";
    case "contact":
      return "Contact Us";
    default:
      return "Section";
  }
}

function createPageContent(site: SitePlan, page: SitePlan["pages"][number]): ContentPageContent {
  const headline =
    page.slug === "home"
      ? `${site.businessType} website built to ${site.siteGoal}`
      : `${page.title} | ${site.businessType}`;

  const sections = page.sections.map((section) => ({
    sectionId: section.id,
    heading: sectionHeading(section.sectionType, page.title),
    body:
      section.sectionType === "contact"
        ? "Share your goals and timeline. We will respond with the best next step."
        : `This section explains how ${site.businessType.toLowerCase()} teams can ${site.siteGoal} with clear, conversion-focused messaging.`,
    cta: section.sectionType === "cta" ? site.primaryCTA : undefined,
  }));

  return {
    pageId: page.id,
    title: page.title,
    slug: page.slug,
    headline,
    subheadline: `Built for ${site.targetAudience ?? "qualified prospects"} with clear decision-making paths.`,
    sections,
    cta: site.primaryCTA,
  };
}

export function runContentAgentDeterministic(sitePlan: SitePlan): ContentPackage {
  return {
    siteTitle: `${sitePlan.businessType} Growth Site`,
    brandVoice: "clear, confident, conversion-focused",
    pages: sitePlan.pages.map((page) => createPageContent(sitePlan, page)),
  };
}

const contentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["siteTitle", "brandVoice", "pages"],
  properties: {
    siteTitle: { type: "string" },
    brandVoice: { type: "string" },
    pages: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pageId", "title", "slug", "headline", "subheadline", "sections", "cta"],
        properties: {
          pageId: { type: "string" },
          title: { type: "string" },
          slug: { type: "string" },
          headline: { type: "string" },
          subheadline: { type: "string" },
          cta: { type: "string" },
          sections: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["sectionId", "heading", "body", "cta"],
              properties: {
                sectionId: { type: "string" },
                heading: { type: "string" },
                body: { type: "string" },
                cta: { type: ["string", "null"] },
              },
            },
          },
        },
      },
    },
  },
} as const;

export async function runContentAgent(params: {
  sitePlan: SitePlan;
  brief: WebsiteBrief;
  model: string;
  apiKey: string;
}): Promise<ContentPackage> {
  const raw = await generateStructuredJson<unknown>({
    apiKey: params.apiKey,
    model: params.model,
    schemaName: "siteforge_content_package",
    schema: contentSchema as unknown as Record<string, unknown>,
    system:
      "You are SiteForge content agent. Return only valid JSON matching schema. Create concise, high-conversion, truthful website copy.",
    user: [
      `Business name: ${params.brief.businessName}`,
      `Business type: ${params.brief.businessType}`,
      `Business description: ${params.brief.businessDescription}`,
      `Audience: ${params.brief.targetAudience}`,
      `Website goal: ${params.brief.websiteGoal}`,
      `Main offer: ${params.brief.mainOffer}`,
      `Brand tone: ${params.brief.brandTone}`,
      `Plan JSON: ${JSON.stringify(params.sitePlan)}`,
    ].join("\n"),
  });

  return validateContentPackage(raw);
}
