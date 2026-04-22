import { describe, expect, it } from "vitest";
import { sectionHtml } from "@/lib/siteforge/utils";

describe("siteforge render output", () => {
  it("renders hero without placeholder visual labels and with dual CTA row", () => {
    const html = sectionHtml("Smarter Pet Care", "Clear daily care.\nMedication reminders.\nFamily handoffs.", "Start free trial", {
      sectionType: "hero",
      visualPattern: "hero_split",
      mockupRenderStrategy: "framed_ui_mockup_with_value_callouts_without_placeholder_labels",
      heroVisualStrategy: "category_clarity_plus_differentiated_promise_plus_feature_chips",
      sectionSpacingProfile: "premium_hero_spacious",
      sectionTransitionStrategy: "hero_to_value_transition",
    });

    expect(html).toContain("Product workflow snapshot");
    expect(html).toContain("sf-btn-row");
    expect(html).toContain("See details");
    expect(html.toLowerCase()).not.toContain("app preview area");
    expect(html.toLowerCase()).not.toContain("placeholder");
  });

  it("renders trust strip with assurance fallback and no fabricated proof labels", () => {
    const html = sectionHtml("Why teams trust this", "", "Talk to us", {
      visualPattern: "trust_strip",
      sectionTransitionStrategy: "alternating_surface_and_accent_bands",
    });

    expect(html).toContain("Assurance");
    expect(html).toContain("Transparent implementation steps");
    expect(html).not.toContain("Trusted by growing teams");
    expect(html.toLowerCase()).not.toContain("fake");
  });
});
