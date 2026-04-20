import { BuildSpec, CapabilityCheckResult, ThriveIntelligence } from "@/lib/siteforge/contracts";

export type ThriveTranslationResult = {
  spec: BuildSpec;
  appliedMappings: string[];
  fallbackUsed: boolean;
  intelligenceUsed: boolean;
};

export function detectThriveCapability(capability: CapabilityCheckResult): boolean {
  return capability.thriveDetected;
}

export function applyThriveMappings(spec: BuildSpec, enabled: boolean, intelligence: ThriveIntelligence | null): ThriveTranslationResult {
  if (!enabled) {
    return {
      spec,
      appliedMappings: [],
      fallbackUsed: true,
      intelligenceUsed: false,
    };
  }

  const symbolRoleIndex = {
    header: intelligence?.symbolSummary.headers ?? 0,
    footer: intelligence?.symbolSummary.footers ?? 0,
    section: intelligence?.symbolSummary.sections ?? 0,
  };

  const appliedMappings: string[] = [];
  const translated = {
    ...spec,
    metadata: {
      ...spec.metadata,
      thriveAware: true,
      thriveMode: "wp_safe_mode" as const,
      thriveIntelligenceUsed: Boolean(intelligence),
    },
    pages: spec.pages.map((page) => {
      const isHomepage = page.slug === spec.homepageSlug;
      const thriveLayoutKey = isHomepage ? "thrive-homepage-canonical" : "thrive-standard-content";
      const thrivePageRole: "homepage" | "content" = isHomepage ? "homepage" : "content";
      appliedMappings.push(`${page.slug}:${thriveLayoutKey}:${thrivePageRole}`);
      return {
        ...page,
        metadata: {
          ...page.metadata,
          thriveLayoutKey,
          thrivePageRole,
          preferredRenderTarget: "wordpress_page_content" as const,
          renderMode: "thrive-template",
          thriveExecutionMode: "wp_safe_mode" as const,
        },
        sections: page.sections.map((section) => {
          const sectionIntent: "conversion" | "informational" | "trust" | "navigation" =
            section.type === "hero" || section.type === "cta" ? "conversion" : "informational";
          const thriveSymbolRoleCandidate: "header" | "footer" | "section" | "unknown" =
            section.type === "hero"
              ? (symbolRoleIndex.header > 0 ? "header" : "unknown")
              : section.type === "contact"
                ? (symbolRoleIndex.footer > 0 ? "footer" : "section")
                : symbolRoleIndex.section > 0
                  ? "section"
                  : "unknown";

          return {
            ...section,
            metadata: {
              ...(section.metadata ?? {}),
              sectionIntent,
              thriveSymbolRoleCandidate,
              preferredRenderTarget: "wordpress_page_content" as const,
            },
          };
        }),
      };
    }),
  };

  return {
    spec: translated,
    appliedMappings,
    fallbackUsed: false,
    intelligenceUsed: Boolean(intelligence),
  };
}
