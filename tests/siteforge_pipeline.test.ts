import { describe, expect, it } from "vitest";
import { runPlannerAgent } from "@/lib/siteforge/agents/planner";
import { runContentAgent } from "@/lib/siteforge/agents/content";
import { runBuildSpecAgent } from "@/lib/siteforge/agents/buildSpec";
import { runQaAgent } from "@/lib/siteforge/agents/qa";
import { applyBuildDelta, createBuildDelta } from "@/lib/siteforge/refinement";

describe("siteforge deterministic pipeline", () => {
  it("builds plan, content, spec, and QA output from prompt", () => {
    const plan = runPlannerAgent("Build a coaching website that books discovery calls");
    expect(plan.businessType).toBe("Coaching");
    expect(plan.pages.length).toBeGreaterThanOrEqual(3);

    const content = runContentAgent(plan);
    expect(content.pages.length).toBe(plan.pages.length);
    expect(content.siteTitle).toContain("Coaching");

    const spec = runBuildSpecAgent(plan, content);
    expect(spec.pages.length).toBe(plan.pages.length);
    expect(spec.homepageSlug).toBe("home");

    const qa = runQaAgent(spec);
    expect(qa.isValid).toBe(true);
    expect(qa.errors).toHaveLength(0);
  });

  it("creates and applies targeted revision delta", () => {
    const plan = runPlannerAgent("Build an ecommerce site");
    const content = runContentAgent(plan);
    const spec = runBuildSpecAgent(plan, content);

    const delta = createBuildDelta({ message: "make it more premium and add testimonials" });
    expect(delta.operations.length).toBeGreaterThan(0);

    const revised = applyBuildDelta(spec, delta);
    const home = revised.pages.find((page) => page.slug === "home");
    expect(home).toBeTruthy();
    expect(home?.sections.some((section) => /Refinement applied/i.test(section.body) || /New Conversion Section/i.test(section.heading))).toBe(true);
  });
});
