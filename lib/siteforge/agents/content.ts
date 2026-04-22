import { ContentPackage, ContentPageContent, MarketIntelligenceBrief, SitePlan, WebsiteBrief } from "@/lib/siteforge/contracts";
import { validateContentPackage } from "@/lib/siteforge/agents/validators";
import { generateStructuredJson } from "@/lib/siteforge/llm/openai";

const forbiddenPlaceholderPattern = /app preview area|placeholder|lorem ipsum|your text here|coming soon section/i;
const fakeTestimonialPattern = /"[^\"]{10,}"\s*-\s*(?:[A-Za-z]+\s+)?(founder|owner|ceo|customer|user|parent|vet|dr\.)\b/i;
const genericFillerPattern = /trusted,?\s*accurate,?\s*personalized|smart decisions|personalized insights|trusted by experts alike|ai-powered/i;

function isAppLike(brief: WebsiteBrief, sitePlan: SitePlan): boolean {
  const corpus = `${brief.businessType} ${brief.businessDescription} ${brief.mainOffer} ${sitePlan.businessSummary}`.toLowerCase();
  return /app|saas|software|platform|mobile|ios|android/.test(corpus);
}

function isPetCareContext(brief: WebsiteBrief): boolean {
  const corpus = `${brief.businessType} ${brief.businessDescription} ${brief.mainOffer} ${brief.differentiators ?? ""}`.toLowerCase();
  return /pet|dog|cat|veterinary|vet|caregiver|vaccin|medication/.test(corpus);
}

function sectionHeading(sectionType: string, pageTitle: string): string {
  switch (sectionType) {
    case "hero":
      return pageTitle === "Home" ? "A clearer way to manage care and take action" : `${pageTitle} with practical next steps`;
    case "problem":
      return "Where care workflows usually break down";
    case "solution":
      return "How this product keeps care organized";
    case "features":
      return "Core product capabilities";
    case "testimonials":
      return "Why teams and families trust this workflow";
    case "cta":
      return "Start with a clear next step";
    case "faq":
      return "Questions people ask before they commit";
    case "contact":
      return "Get in touch";
    default:
      return "Section";
  }
}

function buildPrimaryCta(brief: WebsiteBrief): string {
  if (brief.websiteGoal === "drive_demos_trials") return "Start your free trial";
  if (brief.websiteGoal === "book_calls") return "Book a call";
  if (brief.websiteGoal === "sell_products") return "Shop now";
  return "Get started";
}

function inferFeaturePillars(brief: WebsiteBrief): string[] {
  if (isPetCareContext(brief)) {
    return [
      "Complete pet records in one timeline",
      "Medication and vaccination tracking without guesswork",
      "Smart reminders for treatments, refills, and appointments",
      "Caregiver and family coordination with shared visibility",
      "Grounded Cosmo help that supports, not replaces, veterinary care",
    ];
  }

  const extracted = [brief.mainOffer, brief.differentiators ?? "", brief.businessDescription]
    .join(" ")
    .split(/[,.]| and /i)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8)
    .slice(0, 4);

  if (extracted.length) return extracted;
  return [
    "A clear workflow from first visit to conversion",
    "Faster decisions with less operational overhead",
    "Consistent messaging across your highest-intent pages",
  ];
}

function createHeroCopy(params: { brief: WebsiteBrief; sitePlan: SitePlan }): { headline: string; subheadline: string; cta: string } {
  const { brief } = params;
  const cta = buildPrimaryCta(brief);
  const audience = brief.targetAudience.trim() || "high-intent customers";

  if (isPetCareContext(brief)) {
    return {
      headline: "Keep every part of pet care clear, organized, and on time",
      subheadline:
        "Built for pet parents and caregivers who need medication tracking, vaccine records, reminders, and coordinated support in one place.",
      cta,
    };
  }

  const valueLead = brief.mainOffer.trim() || "a clear path from interest to conversion";
  const businessName = brief.businessName.trim();
  return {
    headline: businessName ? `${businessName} helps ${audience} act with confidence` : `A better way for ${audience} to ${valueLead.toLowerCase()}`,
    subheadline: "Turn your core offer into a focused landing experience that explains the problem, proves your approach, and drives action.",
    cta,
  };
}

function sanitizeCopy(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (forbiddenPlaceholderPattern.test(cleaned)) return "";
  if (genericFillerPattern.test(cleaned)) return cleaned.replace(genericFillerPattern, "clear, grounded, and practical");
  return cleaned;
}

function createSectionBody(params: {
  sectionType: SitePlan["pages"][number]["sections"][number]["sectionType"];
  brief: WebsiteBrief;
  sitePlan: SitePlan;
  pillars: string[];
  cta: string;
}): string {
  const { sectionType, brief, sitePlan, pillars, cta } = params;
  const audience = brief.targetAudience.trim() || sitePlan.targetAudience || "your audience";

  if (sectionType === "problem") {
    return `Most ${audience} juggle updates across scattered notes, reminders, and messages. That creates missed steps, delayed follow-through, and lower confidence when action is time-sensitive.`;
  }
  if (sectionType === "solution") {
    return "This workflow turns complex tasks into clear, guided steps with practical context. Teams know what happened, what matters now, and what should happen next.";
  }
  if (sectionType === "features") {
    return `Feature pillars: ${pillars.slice(0, 5).join("; ")}.`;
  }
  if (sectionType === "testimonials") {
    return "Built on practical trust signals: organized records, clearer communication, coordinated care handoffs, and grounded guidance tied to real workflows.";
  }
  if (sectionType === "faq") {
    return "Answer implementation, safety, data clarity, and onboarding questions directly so visitors can evaluate fit without friction.";
  }
  if (sectionType === "cta") {
    return `Move from research to action with a clear next step: ${cta}.`;
  }
  if (sectionType === "contact") {
    return "Share your current setup, timeline, and priorities. We will follow up with a practical rollout path.";
  }

  return `This section supports ${sitePlan.siteGoal} with concrete proof and a clear decision path.`;
}

function createPageContent(params: {
  sitePlan: SitePlan;
  page: SitePlan["pages"][number];
  brief: WebsiteBrief;
  existing?: ContentPageContent | null;
}): ContentPageContent {
  const { sitePlan, page, brief, existing } = params;
  const hero = createHeroCopy({ brief, sitePlan });
  const pillars = inferFeaturePillars(brief);
  const cta = buildPrimaryCta(brief);
  const appLike = isAppLike(brief, sitePlan);

  const baseHeadline =
    page.slug === "home"
      ? hero.headline
      : page.title === "FAQ"
        ? "Answers that remove buying friction"
        : `${page.title} for ${brief.businessName.trim() || brief.businessType}`;

  const baseSubheadline =
    page.slug === "home"
      ? hero.subheadline
      : appLike
        ? "Concise, practical copy focused on clarity, trust, and conversion."
        : "Clear positioning and next steps for qualified visitors.";

  const sections = page.sections.map((section) => {
    const previous = existing?.sections.find((item) => item.sectionId === section.id);
    const generatedBody = createSectionBody({
      sectionType: section.sectionType,
      brief,
      sitePlan,
      pillars,
      cta,
    });
    const body = sanitizeCopy(previous?.body ?? "") || sanitizeCopy(generatedBody);
    const heading = sanitizeCopy(previous?.heading ?? "") || sectionHeading(section.sectionType, page.title);
    return {
      sectionId: section.id,
      heading,
      body: body || `This section explains how ${brief.businessName.trim() || brief.businessType} helps ${brief.targetAudience.trim() || "customers"}.`,
      cta: section.sectionType === "cta" ? cta : undefined,
    };
  });

  return {
    pageId: page.id,
    title: page.title,
    slug: page.slug,
    headline: page.slug === "home" ? baseHeadline : sanitizeCopy(existing?.headline ?? "") || baseHeadline,
    subheadline: page.slug === "home" ? baseSubheadline : sanitizeCopy(existing?.subheadline ?? "") || baseSubheadline,
    sections,
    cta: sanitizeCopy(existing?.cta ?? "") || cta,
  };
}

export function enforceContentQuality(params: {
  contentPackage: ContentPackage;
  sitePlan: SitePlan;
  brief: WebsiteBrief;
}): ContentPackage {
  const { contentPackage, sitePlan, brief } = params;
  const pages = sitePlan.pages.map((page) => {
    const existing = contentPackage.pages.find((entry) => entry.pageId === page.id || entry.slug === page.slug) ?? null;
    const normalized = createPageContent({ sitePlan, page, brief, existing });

    const sections = normalized.sections.map((section) => {
      const heading = sanitizeCopy(section.heading) || "Section";
      let body = sanitizeCopy(section.body);
      if (fakeTestimonialPattern.test(body)) {
        body = "Use trust framing based on workflow clarity, organization, and coordinated support rather than fabricated quotes.";
      }
      if (!body) {
        body = "Ground this section in your actual product workflow and measurable user value.";
      }
      return {
        ...section,
        heading,
        body,
      };
    });

    return {
      ...normalized,
      headline:
        forbiddenPlaceholderPattern.test(normalized.headline) || genericFillerPattern.test(normalized.headline)
          ? createHeroCopy({ brief, sitePlan }).headline
          : normalized.headline,
      sections,
    };
  });

  return {
    siteTitle: sanitizeCopy(contentPackage.siteTitle) || `${brief.businessName.trim() || sitePlan.businessType} Website`,
    brandVoice: sanitizeCopy(contentPackage.brandVoice) || "clear, grounded, conversion-focused",
    pages,
  };
}

export function runContentAgentDeterministic(sitePlan: SitePlan): ContentPackage {
  const fallbackBrief: WebsiteBrief = {
    businessName: sitePlan.businessType,
    businessType: sitePlan.businessType,
    businessDescription: sitePlan.businessSummary,
    targetAudience: sitePlan.targetAudience ?? "high-intent visitors",
    websiteGoal: "capture_leads",
    mainOffer: sitePlan.siteGoal,
    brandTone: "modern",
    marketLocation: null,
    competitors: null,
    differentiators: null,
  };

  return enforceContentQuality({
    contentPackage: {
      siteTitle: `${sitePlan.businessType} Growth Site`,
      brandVoice: "clear, confident, conversion-focused",
      pages: sitePlan.pages.map((page) =>
        createPageContent({
          sitePlan,
          page,
          brief: fallbackBrief,
        })
      ),
    },
    sitePlan,
    brief: fallbackBrief,
  });
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
  marketIntelligence?: MarketIntelligenceBrief | null;
}): Promise<ContentPackage> {
  const raw = await generateStructuredJson<unknown>({
    apiKey: params.apiKey,
    model: params.model,
    schemaName: "siteforge_content_package",
    schema: contentSchema as unknown as Record<string, unknown>,
    user: [
      `Business name: ${params.brief.businessName}`,
      `Business type: ${params.brief.businessType}`,
      `Business description: ${params.brief.businessDescription}`,
      `Audience: ${params.brief.targetAudience}`,
      `Website goal: ${params.brief.websiteGoal}`,
      `Main offer: ${params.brief.mainOffer}`,
      `Brand tone: ${params.brief.brandTone}`,
      params.marketIntelligence
        ? `Market intelligence brief: ${JSON.stringify({
            status: params.marketIntelligence.status,
            source: params.marketIntelligence.source,
            recurringValueProps: params.marketIntelligence.recurringValueProps,
            trustSignals: params.marketIntelligence.trustSignals,
            ctaPatterns: params.marketIntelligence.ctaPatterns,
            faqThemes: params.marketIntelligence.faqThemes,
            appStorePositioningHints: params.marketIntelligence.appStorePositioningHints,
            contentWarnings: params.marketIntelligence.contentWarnings,
          })}`
        : "",
      `Plan JSON: ${JSON.stringify(params.sitePlan)}`,
    ].join("\n"),
    system:
      "You are SiteForge content agent. Return only valid JSON matching schema. Produce premium landing-page copy that is specific, truthful, and grounded in the brief. Lead with a strong value proposition, explicit audience, concrete problem/solution framing, and CTA language tied to the goal. Do not use fake testimonials, fake endorsements, fabricated metrics, or placeholders like App Preview Area. If validated proof is absent, write neutral trust/assurance copy without quotes. Avoid generic AI filler and repetitive claims.",
  });

  const parsed = validateContentPackage(raw);
  return enforceContentQuality({
    contentPackage: parsed,
    sitePlan: params.sitePlan,
    brief: params.brief,
  });
}
