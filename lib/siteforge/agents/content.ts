import { ContentPackage, ContentPageContent, SitePlan } from "@/lib/siteforge/contracts";

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

export function runContentAgent(sitePlan: SitePlan): ContentPackage {
  return {
    siteTitle: `${sitePlan.businessType} Growth Site`,
    brandVoice: "clear, confident, conversion-focused",
    pages: sitePlan.pages.map((page) => createPageContent(sitePlan, page)),
  };
}
