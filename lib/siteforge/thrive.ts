import { BuildSpec, CapabilityCheckResult } from "@/lib/siteforge/contracts";

export type ThriveTranslationResult = {
  spec: BuildSpec;
  appliedMappings: string[];
  fallbackUsed: boolean;
};

export function detectThriveCapability(capability: CapabilityCheckResult): boolean {
  return capability.thriveDetected;
}

export function applyThriveMappings(spec: BuildSpec, enabled: boolean): ThriveTranslationResult {
  if (!enabled) {
    return {
      spec,
      appliedMappings: [],
      fallbackUsed: true,
    };
  }

  const appliedMappings: string[] = [];
  const translated = {
    ...spec,
    metadata: {
      ...spec.metadata,
      thriveAware: true,
    },
    pages: spec.pages.map((page) => {
      const thriveLayoutKey = page.slug === "home" ? "thrive-home-conversion" : "thrive-standard-content";
      appliedMappings.push(`${page.slug}:${thriveLayoutKey}`);
      return {
        ...page,
        metadata: {
          ...page.metadata,
          thriveLayoutKey,
          renderMode: "thrive-template",
        },
      };
    }),
  };

  return {
    spec: translated,
    appliedMappings,
    fallbackUsed: false,
  };
}
