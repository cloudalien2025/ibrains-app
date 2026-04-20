import { BuildSpec, BuildSpecPage, ContentPackage, PageIntent, SitePlan } from "@/lib/siteforge/contracts";
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

function pageRole(slug: string, homepageSlug: string): PageIntent {
  const normalized = slug.toLowerCase().trim();
  if (normalized === homepageSlug.toLowerCase().trim() || normalized === "home") return "homepage";
  if (normalized.includes("about")) return "about";
  if (normalized.includes("contact")) return "contact";
  if (normalized.includes("faq")) return "faq";
  if (normalized.includes("feature")) return "features";
  if (normalized.includes("pricing") || normalized.includes("plans")) return "pricing";
  return "generic";
}

function shellRoleForPage(role: PageIntent): NonNullable<BuildSpec["pages"][number]["metadata"]["shellRole"]> {
  if (role === "homepage") return "homepage_shell";
  if (role === "contact") return "utility_shell";
  if (role === "features" || role === "pricing") return "conversion_shell";
  if (role === "about" || role === "faq") return "standard_shell";
  return "unknown";
}

export function runBuildSpecAgent(sitePlan: SitePlan, contentPackage: ContentPackage): BuildSpec {
  const pages = sitePlan.pages.map((page) => {
    const content = contentPackage.pages.find((entry) => entry.pageId === page.id);

    const sections = page.sections.map((section) => {
      const match = content?.sections.find((entry) => entry.sectionId === section.id);
      const role = pageRole(page.slug, sitePlan.homepageSlug);
      const candidateType: NonNullable<BuildSpec["pages"][number]["sections"][number]["metadata"]>["symbolCandidateType"] =
        section.sectionType === "hero"
          ? "header"
          : section.sectionType === "contact"
            ? "footer"
            : section.sectionType === "cta"
              ? "cta"
              : section.sectionType === "faq"
                ? "faq"
                : section.sectionType === "testimonials"
                  ? "testimonial"
                  : "marketing";
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
          pageRole: role,
          shellRole: shellRoleForPage(role),
          shellTemplateGroupCandidate: role === "homepage" ? "homepage" : "content",
          shellLayoutCandidate: role === "homepage" ? "thrive-homepage-canonical" : "thrive-standard-content",
          symbolCandidateType: candidateType,
          reusableSymbolCandidates: [],
          contentTemplateCandidates: [],
          landingPageCandidate: role === "homepage" ? `${page.slug}-landing` : null,
          rendererMode: "wp_safe_mode" as const,
          contractCaptureRef: null,
          sectionIntent: sectionIntent(section.sectionType),
          preferredRenderTarget: "wordpress_page_content" as const,
          thriveSymbolRoleCandidate,
        },
      };
    });

    const role = pageRole(page.slug, sitePlan.homepageSlug);
    return {
      pageId: page.id,
      title: page.title,
      slug: page.slug,
      purpose: page.purpose,
      sections,
      metadata: {
        template: templateForSlug(page.slug),
        pageRole: role,
        shellRole: shellRoleForPage(role),
        shellTemplateGroupCandidate: role === "homepage" ? "homepage" : "content",
        shellLayoutCandidate: role === "homepage" ? "thrive-homepage-canonical" : "thrive-standard-content",
        reusableSymbolCandidates: [],
        contentTemplateCandidates: [],
        landingPageCandidate: role === "homepage" ? `${page.slug}-landing` : null,
        rendererMode: "wp_safe_mode" as const,
        contractCaptureRef: null,
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
      thriveExecutionMode: "wp_safe_mode",
      thriveIntelligenceUsed: false,
      themeArtifactRef: null,
      architectContentArtifactRef: null,
      landingPageArtifactRef: null,
      designPackArtifactRef: null,
      contractCaptureRef: null,
      createdAt: nowIso(),
    },
  };
}
