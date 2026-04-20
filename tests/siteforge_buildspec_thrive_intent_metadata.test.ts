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
    expect(spec.metadata.thriveIntelligenceUsed).toBe(false);

    for (const page of spec.pages) {
      expect(page.metadata.preferredRenderTarget).toBe("wordpress_page_content");
      for (const section of page.sections) {
        expect(section.metadata?.preferredRenderTarget).toBe("wordpress_page_content");
        expect(["conversion", "informational", "trust", "navigation"]).toContain(section.metadata?.sectionIntent);
        expect(["header", "footer", "section", "unknown"]).toContain(section.metadata?.thriveSymbolRoleCandidate);
      }
    }
  });
});
