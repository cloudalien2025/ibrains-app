import { BuildSpec, BuildSpecPage, ContentPackage, SitePlan } from "@/lib/siteforge/contracts";
import { nowIso } from "@/lib/siteforge/utils";

function templateForSlug(slug: string): BuildSpecPage["metadata"]["template"] {
  if (slug === "home") return "landing";
  if (slug === "contact") return "contact";
  return "standard";
}

function sectionIntent(sectionType: BuildSpec["pages"][number]["sections"][number]["type"]): "conversion" | "informational" | "trust" | "navigation" {
  if (sectionType === "hero" || sectionType === "cta") return "conversion";
  if (sectionType === "testimonials") return "trust";
  if (sectionType === "contact") return "navigation";
  return "informational";
}

export function runBuildSpecAgent(sitePlan: SitePlan, contentPackage: ContentPackage): BuildSpec {
  const pages = sitePlan.pages.map((page) => {
    const content = contentPackage.pages.find((entry) => entry.pageId === page.id);

    const sections = page.sections.map((section) => {
      const match = content?.sections.find((entry) => entry.sectionId === section.id);
      const thriveSymbolRoleCandidate: "header" | "footer" | "section" | "unknown" =
        section.sectionType === "hero"
          ? "header"
          : section.sectionType === "contact"
            ? "footer"
            : "section";
      return {
        id: section.id,
        type: section.sectionType,
        heading: match?.heading ?? `${page.title} section`,
        body: match?.body ?? section.purpose,
        cta: match?.cta,
        metadata: {
          source: "siteforge-v1",
          pageSlug: page.slug,
          sectionIntent: sectionIntent(section.sectionType),
          preferredRenderTarget: "wordpress_page_content" as const,
          thriveSymbolRoleCandidate,
        },
      };
    });

    return {
      pageId: page.id,
      title: page.title,
      slug: page.slug,
      purpose: page.purpose,
      sections,
      metadata: {
        template: templateForSlug(page.slug),
        preferredRenderTarget: "wordpress_page_content" as const,
      },
    };
  });

  return {
    siteTitle: contentPackage.siteTitle,
    homepageSlug: sitePlan.homepageSlug,
    menu: sitePlan.navigation.map((label) => ({
      label,
      slug: pages.find((page) => page.title === label)?.slug ?? "home",
    })),
    pages,
    metadata: {
      conversionFocus: "high",
      thriveAware: false,
      thriveMode: "wp_safe_mode",
      thriveIntelligenceUsed: false,
      createdAt: nowIso(),
    },
  };
}
