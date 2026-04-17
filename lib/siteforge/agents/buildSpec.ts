import { BuildSpec, BuildSpecPage, ContentPackage, SitePlan } from "@/lib/siteforge/contracts";
import { nowIso } from "@/lib/siteforge/utils";

function templateForSlug(slug: string): BuildSpecPage["metadata"]["template"] {
  if (slug === "home") return "landing";
  if (slug === "contact") return "contact";
  return "standard";
}

export function runBuildSpecAgent(sitePlan: SitePlan, contentPackage: ContentPackage): BuildSpec {
  const pages = sitePlan.pages.map((page) => {
    const content = contentPackage.pages.find((entry) => entry.pageId === page.id);

    const sections = page.sections.map((section) => {
      const match = content?.sections.find((entry) => entry.sectionId === section.id);
      return {
        id: section.id,
        type: section.sectionType,
        heading: match?.heading ?? `${page.title} section`,
        body: match?.body ?? section.purpose,
        cta: match?.cta,
        metadata: {
          source: "siteforge-v1",
          pageSlug: page.slug,
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
      createdAt: nowIso(),
    },
  };
}
