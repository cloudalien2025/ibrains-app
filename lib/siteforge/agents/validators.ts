import { ContentPackage, SitePlan } from "@/lib/siteforge/contracts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function validateSitePlan(value: unknown): SitePlan {
  if (!isRecord(value)) {
    throw new Error("Planner returned non-object payload.");
  }

  const businessType = asString(value.businessType);
  const businessSummary = asString(value.businessSummary);
  const siteGoal = asString(value.siteGoal);
  const primaryCTA = asString(value.primaryCTA);
  const homepageSlug = asString(value.homepageSlug);

  if (!businessType || !businessSummary || !siteGoal || !primaryCTA || !homepageSlug) {
    throw new Error("Planner payload missing required top-level fields.");
  }

  const navigation = Array.isArray(value.navigation) ? value.navigation.filter((item): item is string => typeof item === "string") : [];
  const assumptions = Array.isArray(value.assumptions) ? value.assumptions.filter((item): item is string => typeof item === "string") : [];
  const warnings = Array.isArray(value.warnings) ? value.warnings.filter((item): item is string => typeof item === "string") : [];
  const targetAudience = value.targetAudience === null ? null : asString(value.targetAudience);

  const pagesRaw = Array.isArray(value.pages) ? value.pages : [];
  if (!pagesRaw.length) {
    throw new Error("Planner payload must include at least one page.");
  }

  const pages = pagesRaw.map((page, pageIndex) => {
    if (!isRecord(page)) {
      throw new Error(`Planner page[${pageIndex}] is invalid.`);
    }

    const id = asString(page.id);
    const title = asString(page.title);
    const slug = asString(page.slug);
    const purpose = asString(page.purpose);
    if (!id || !title || !slug || !purpose) {
      throw new Error(`Planner page[${pageIndex}] is missing fields.`);
    }

    const sectionsRaw = Array.isArray(page.sections) ? page.sections : [];
    if (!sectionsRaw.length) {
      throw new Error(`Planner page[${pageIndex}] has no sections.`);
    }

    const sections = sectionsRaw.map((section, sectionIndex) => {
      if (!isRecord(section)) {
        throw new Error(`Planner section[${pageIndex}:${sectionIndex}] is invalid.`);
      }
      const sectionId = asString(section.id);
      const sectionType = asString(section.sectionType);
      const purposeText = asString(section.purpose);
      if (!sectionId || !sectionType || !purposeText) {
        throw new Error(`Planner section[${pageIndex}:${sectionIndex}] is missing fields.`);
      }
      if (!["hero", "problem", "solution", "features", "testimonials", "cta", "faq", "contact"].includes(sectionType)) {
        throw new Error(`Planner section[${pageIndex}:${sectionIndex}] has unsupported sectionType.`);
      }
      return {
        id: sectionId,
        sectionType: sectionType as SitePlan["pages"][number]["sections"][number]["sectionType"],
        purpose: purposeText,
      };
    });

    return {
      id,
      title,
      slug,
      purpose,
      sections,
    };
  });

  return {
    businessType,
    businessSummary,
    siteGoal,
    primaryCTA,
    targetAudience,
    homepageSlug,
    navigation,
    pages,
    assumptions,
    warnings,
  };
}

export function validateContentPackage(value: unknown): ContentPackage {
  if (!isRecord(value)) {
    throw new Error("Content agent returned non-object payload.");
  }

  const siteTitle = asString(value.siteTitle);
  const brandVoice = asString(value.brandVoice);
  if (!siteTitle || !brandVoice) {
    throw new Error("Content payload missing top-level fields.");
  }

  const pagesRaw = Array.isArray(value.pages) ? value.pages : [];
  if (!pagesRaw.length) {
    throw new Error("Content payload must include pages.");
  }

  const pages = pagesRaw.map((page, pageIndex) => {
    if (!isRecord(page)) {
      throw new Error(`Content page[${pageIndex}] is invalid.`);
    }

    const pageId = asString(page.pageId);
    const title = asString(page.title);
    const slug = asString(page.slug);
    const headline = asString(page.headline);
    const subheadline = asString(page.subheadline);
    const cta = asString(page.cta);

    if (!pageId || !title || !slug || !headline || !subheadline || !cta) {
      throw new Error(`Content page[${pageIndex}] missing required fields.`);
    }

    const sectionsRaw = Array.isArray(page.sections) ? page.sections : [];
    const sections = sectionsRaw.map((section, sectionIndex) => {
      if (!isRecord(section)) {
        throw new Error(`Content section[${pageIndex}:${sectionIndex}] is invalid.`);
      }

      const sectionId = asString(section.sectionId);
      const heading = asString(section.heading);
      const body = asString(section.body);
      if (!sectionId || !heading || !body) {
        throw new Error(`Content section[${pageIndex}:${sectionIndex}] missing required fields.`);
      }

      return {
        sectionId,
        heading,
        body,
        cta: asString(section.cta) ?? undefined,
      };
    });

    return {
      pageId,
      title,
      slug,
      headline,
      subheadline,
      sections,
      cta,
    };
  });

  return {
    siteTitle,
    brandVoice,
    pages,
  };
}
