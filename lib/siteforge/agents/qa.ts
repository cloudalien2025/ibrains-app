import { BuildSpec, QAError, QAResult, QAWarning } from "@/lib/siteforge/contracts";

export function runQaAgent(spec: BuildSpec): QAResult {
  const warnings: QAWarning[] = [];
  const errors: QAError[] = [];

  if (!spec.siteTitle.trim()) {
    errors.push({ code: "SITE_TITLE_REQUIRED", message: "BuildSpec siteTitle is required.", field: "siteTitle" });
  }

  if (!spec.pages.length) {
    errors.push({ code: "PAGES_REQUIRED", message: "BuildSpec must include at least one page.", field: "pages" });
  }

  const slugSet = new Set<string>();
  spec.pages.forEach((page) => {
    if (slugSet.has(page.slug)) {
      errors.push({ code: "DUPLICATE_SLUG", message: `Duplicate page slug: ${page.slug}`, field: "pages.slug" });
    }
    slugSet.add(page.slug);

    if (!page.sections.length) {
      warnings.push({ code: "PAGE_WITHOUT_SECTIONS", message: `${page.title} has no sections.` });
    }

    page.sections.forEach((section) => {
      if (!section.body.trim()) {
        warnings.push({
          code: "EMPTY_SECTION_BODY",
          message: `Section ${section.id} on ${page.slug} has empty body text.`,
          field: "sections.body",
        });
      }
    });
  });

  if (!spec.menu.length) {
    warnings.push({ code: "MENU_EMPTY", message: "Menu has no entries. Homepage will still be created." });
  }

  if (!spec.pages.some((page) => page.slug === spec.homepageSlug)) {
    errors.push({
      code: "HOMEPAGE_SLUG_NOT_FOUND",
      message: `Homepage slug ${spec.homepageSlug} does not match any page slug.`,
      field: "homepageSlug",
    });
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    recommendations: [
      "Review CTA wording for offer specificity before launch.",
      "Add legal/privacy pages before going live if needed for your market.",
    ],
  };
}
