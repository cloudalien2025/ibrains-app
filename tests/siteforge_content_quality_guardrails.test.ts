import { describe, expect, it } from "vitest";
import { enforceContentQuality } from "@/lib/siteforge/agents/content";
import { runQaAgent } from "@/lib/siteforge/agents/qa";
import { runBuildSpecAgent } from "@/lib/siteforge/agents/buildSpec";

const petBrief = {
  businessName: "iPetzo",
  businessType: "Mobile pet care app",
  businessDescription: "An app for pet parents to manage records, meds, reminders, and caregiver coordination.",
  targetAudience: "Pet parents and multi-caregiver families",
  websiteGoal: "drive_demos_trials" as const,
  mainOffer: "Daily pet care command center",
  brandTone: "premium" as const,
  marketLocation: null,
  competitors: null,
  differentiators: "Grounded Cosmo help and shared caregiver workflows",
};

const sitePlan = {
  businessType: "SaaS",
  businessSummary: "iPetzo pet care app",
  siteGoal: "drive demos and trials",
  primaryCTA: "Start your free trial",
  targetAudience: "Pet parents",
  homepageSlug: "home",
  navigation: ["Home"],
  assumptions: [],
  warnings: [],
  pages: [
    {
      id: "p_home",
      title: "Home",
      slug: "home",
      purpose: "Primary conversion page",
      sections: [
        { id: "s_hero", sectionType: "hero" as const, purpose: "Hero" },
        { id: "s_features", sectionType: "features" as const, purpose: "Features" },
        { id: "s_testimonials", sectionType: "testimonials" as const, purpose: "Trust" },
        { id: "s_cta", sectionType: "cta" as const, purpose: "CTA" },
      ],
    },
  ],
};

describe("siteforge content quality guardrails", () => {
  it("injects grounded pet-care feature pillars for app landing pages", () => {
    const content = enforceContentQuality({
      brief: petBrief,
      sitePlan,
      contentPackage: {
        siteTitle: "iPetzo",
        brandVoice: "premium",
        pages: [
          {
            pageId: "p_home",
            title: "Home",
            slug: "home",
            headline: "AI-powered pet magic",
            subheadline: "Trusted, accurate, personalized insights",
            cta: "Get started",
            sections: [
              { sectionId: "s_hero", heading: "App Preview Area", body: "Placeholder", cta: null },
              { sectionId: "s_features", heading: "Features", body: "Placeholder features", cta: null },
              { sectionId: "s_testimonials", heading: "Testimonials", body: '"This workflow changed our care routine from chaos to clarity" - Happy Customer', cta: null },
              { sectionId: "s_cta", heading: "CTA", body: "Start", cta: "Start" },
            ],
          },
        ],
      },
    });

    const homepage = content.pages[0];
    const features = homepage?.sections.find((section) => section.sectionId === "s_features")?.body ?? "";
    const trust = homepage?.sections.find((section) => section.sectionId === "s_testimonials")?.body ?? "";

    expect(homepage?.headline).toContain("pet care");
    expect(features).toContain("pet records");
    expect(features).toContain("Medication and vaccination tracking");
    expect(features).toContain("Caregiver and family coordination");
    expect(features).toContain("Grounded Cosmo help");
    expect(trust.toLowerCase()).not.toContain("happy customer");
    expect(content.pages[0]?.sections.some((section) => /app preview area/i.test(section.heading + section.body))).toBe(false);
  });

  it("qa rejects placeholder labels and fake testimonial formatting", () => {
    const content = enforceContentQuality({
      brief: petBrief,
      sitePlan,
      contentPackage: {
        siteTitle: "iPetzo",
        brandVoice: "premium",
        pages: [
          {
            pageId: "p_home",
            title: "Home",
            slug: "home",
            headline: "iPetzo for pet parents",
            subheadline: "Clear daily pet care",
            cta: "Start your free trial",
            sections: [
              { sectionId: "s_hero", heading: "Hero", body: "Clear value", cta: null },
              { sectionId: "s_features", heading: "Features", body: "Feature pillars", cta: null },
              { sectionId: "s_testimonials", heading: "Trust", body: '"This product made every handoff clear and accountable" - Founder', cta: null },
              { sectionId: "s_cta", heading: "CTA", body: "Start now", cta: "Start" },
            ],
          },
        ],
      },
    });

    const spec = runBuildSpecAgent(sitePlan, content);
    spec.pages[0].sections[1].body = "App Preview Area";
    spec.pages[0].sections[2].body = '"This product made every handoff clear and accountable" - Founder';

    const qa = runQaAgent(spec);
    expect(qa.isValid).toBe(false);
    expect(qa.errors.some((entry) => entry.code === "PLACEHOLDER_CONTENT_FORBIDDEN")).toBe(true);
    expect(qa.errors.some((entry) => entry.code === "FAKE_TESTIMONIAL_FORBIDDEN")).toBe(true);
  });
});
