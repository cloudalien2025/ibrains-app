import { describe, expect, it } from "vitest";
import {
  buildSeoPackageFromBrief,
  buildSupportBrief,
  buildSupportResearchArtifact,
  classifySlotAction,
  featuredImageFilenameFromKeyword,
  normalizeSlotValidity,
  progressTowardRequiredValid,
  slugify,
  toStep2UserState,
  type Step2MissionPlan,
  type Step2MissionPlanSlot,
} from "@/lib/directoryiq/step2SupportEngineContract";

const baseSlot: Step2MissionPlanSlot = {
  slot_id: "slot-comparison-1",
  primary_slot: "comparison",
  slot_label: "Comparison",
  slot_reason: "Close comparison gap",
  target_query_family: ["best plumbers", "plumbing comparison"],
  recommended_focus_keyword: "best plumbing services austin",
  recommended_angle: "Compare emergency response and guarantees.",
  existing_candidate_post_id: null,
  existing_candidate_url: null,
  existing_candidate_title: null,
  current_state: "missing",
  recommended_action: "create",
  counts_toward_required_five_now: false,
  step1_confidence: 0.82,
  selected_for_mission: true,
};

const basePlan: Step2MissionPlan = {
  listing_id: "321",
  site_id: "site-1",
  listing_title: "Acme Plumbing",
  listing_url: "https://example.com/listings/acme-plumbing",
  listing_type: "service",
  listing_category: "Plumbing",
  listing_subcategory: "Emergency",
  location_city: "Austin",
  location_area: "Central Austin",
  location_region: "Texas",
  landmarks: ["Downtown"],
  differentiators: ["24/7 service", "Licensed team"],
  audience_fits: ["homeowners"],
  core_entities: ["plumber", "water heater"],
  required_valid_support_count: 5,
  selected_slots: [baseSlot],
};

describe("DirectoryIQ Step 2 support engine contract", () => {
  it("classifies confirm/upgrade/create deterministically", () => {
    expect(classifySlotAction(baseSlot)).toBe("create");

    const upgrade = {
      ...baseSlot,
      existing_candidate_post_id: "p-1",
      current_state: "upgrade_candidate" as const,
    };
    expect(classifySlotAction(upgrade)).toBe("upgrade");

    const confirm = {
      ...upgrade,
      current_state: "valid" as const,
      counts_toward_required_five_now: true,
    };
    expect(classifySlotAction(confirm)).toBe("confirm");
  });

  it("builds research artifact and brief with required SEO/image fields", () => {
    const artifact = buildSupportResearchArtifact({
      slot: baseSlot,
      listingTitle: basePlan.listing_title,
      locationCity: basePlan.location_city,
      locationRegion: basePlan.location_region,
      serpTopResults: [
        { title: "Best plumbing services in Austin", url: "https://example.com/a", rank: 1 },
        { title: "Plumbing comparison guide", url: "https://example.com/b", rank: 2 },
      ],
      userQuestions: ["How do I choose a plumber?"],
    });

    expect(artifact.slot_id).toBe(baseSlot.slot_id);
    expect(artifact.top_results.length).toBe(2);
    expect(artifact.recommended_outline_pattern.length).toBeGreaterThan(0);

    const brief = buildSupportBrief({
      slot: baseSlot,
      plan: basePlan,
      research: artifact,
    });

    const seo = buildSeoPackageFromBrief(brief);
    expect(seo.primary_focus_keyword).toBe(baseSlot.recommended_focus_keyword);
    expect(seo.slug).toMatch(/^[-a-z0-9]+$/);
    expect(seo.featured_image_filename).toContain("best-plumbing-services-austin");
    expect(seo.featured_image_filename.endsWith(".jpg")).toBe(true);
    expect(brief.internal_link_plan.listing_link_required).toBe(true);
  });

  it("normalizes valid-count semantics conservatively", () => {
    const valid = normalizeSlotValidity({
      published: true,
      linked: true,
      metadata_ready: true,
      relevant: true,
      slot_strong: true,
      quality_pass: true,
      non_duplicate: true,
      step3_consumable: true,
    });
    expect(valid.final_state).toBe("valid");
    expect(valid.counts_toward_required_five).toBe(true);

    const publishedNeedsReview = normalizeSlotValidity({
      ...valid,
      metadata_ready: false,
    });
    expect(publishedNeedsReview.final_state).toBe("needs_review");
    expect(publishedNeedsReview.counts_toward_required_five).toBe(false);
  });

  it("maps internal states to user-facing statuses and progress", () => {
    expect(toStep2UserState("researching")).toBe("Creating");
    expect(toStep2UserState("publishing")).toBe("Publishing");
    expect(toStep2UserState("published")).toBe("Published");
    expect(toStep2UserState("failed")).toBe("Failed");

    const progress = progressTowardRequiredValid([
      { counts_toward_required_five: true },
      { counts_toward_required_five: false },
      { counts_toward_required_five: true },
    ]);
    expect(progress.valid_count).toBe(2);
    expect(progress.required_count).toBe(5);
    expect(progress.completion_ratio).toBe(0.4);
  });

  it("enforces deterministic slug/image formatting", () => {
    expect(slugify("Best Family-Friendly Hotels, Vail Village!")).toBe("best-family-friendly-hotels-vail-village");
    expect(featuredImageFilenameFromKeyword("best family friendly hotels vail village")).toBe(
      "best-family-friendly-hotels-vail-village.jpg"
    );
  });
});
