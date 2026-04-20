import { describe, expect, it } from "vitest";
import { runBuildSpecAgent } from "@/lib/siteforge/agents/buildSpec";
import { runPlannerAgentDeterministic } from "@/lib/siteforge/agents/planner";
import { runContentAgentDeterministic } from "@/lib/siteforge/agents/content";

describe("siteforge buildspec thrive-aware intent metadata", () => {
  it("adds additive safe render-target + section intent metadata", () => {
    const plan = runPlannerAgentDeterministic("build an expert consulting website");
    const content = runContentAgentDeterministic(plan);
    const spec = runBuildSpecAgent(plan, content);

    expect(spec.metadata.thriveMode).toBe("wp_safe_mode");
    expect(spec.metadata.thriveExecutionMode).toBe("wp_safe_mode");
    expect(spec.metadata.thriveIntelligenceUsed).toBe(false);

    for (const page of spec.pages) {
      expect(page.metadata.preferredRenderTarget).toBe("wordpress_page_content");
      expect(["homepage", "about", "contact", "faq", "features", "pricing", "generic"]).toContain(page.metadata.pageRole);
      expect(["homepage_shell", "standard_shell", "conversion_shell", "utility_shell", "unknown"]).toContain(page.metadata.shellRole);
      for (const section of page.sections) {
        expect(section.metadata?.preferredRenderTarget).toBe("wordpress_page_content");
        expect(["conversion", "informational", "trust", "navigation"]).toContain(section.metadata?.sectionIntent);
        expect(["header", "footer", "section", "unknown"]).toContain(section.metadata?.thriveSymbolRoleCandidate);
        expect(["header", "footer", "cta", "testimonial", "faq", "marketing", "generic"]).toContain(section.metadata?.symbolCandidateType);
      }
    }
  });
});
