import { describe, expect, it } from "vitest";
import { classifyBlogPost } from "@/src/directoryiq/services/blogPostClassificationEngine";

function rel(input: Partial<Parameters<typeof classifyBlogPost>[0]["listingRelationships"][number]> & { listingId: string; listingName: string }) {
  return {
    listingId: input.listingId,
    listingName: input.listingName,
    listingUrl: input.listingUrl ?? null,
    appearsInTitle: input.appearsInTitle ?? false,
    appearsInH1OrIntro: input.appearsInH1OrIntro ?? false,
    meaningfulBodyMentions: input.meaningfulBodyMentions ?? 0,
    hasDirectLink: input.hasDirectLink ?? false,
    recommendationOrCtaFavoring: input.recommendationOrCtaFavoring ?? false,
    conclusionReinforces: input.conclusionReinforces ?? false,
    hasReciprocalLink: input.hasReciprocalLink ?? false,
    hasMention: input.hasMention ?? false,
  };
}

describe("directoryiq blog post classification engine", () => {
  it("classifies comparison posts with precedence over other possible classes", () => {
    const output = classifyBlogPost({
      postId: "blog-1",
      title: "Austria Haus vs Arrabelle: Which is better in Vail?",
      h1: "Compare two Vail hotels",
      intro: "We compare options side by side.",
      bodyText: "Compare amenities, pricing, and choose the best option.",
      listingRelationships: [
        rel({ listingId: "austria-haus", listingName: "Austria Haus", hasMention: true, hasDirectLink: true, meaningfulBodyMentions: 2 }),
        rel({ listingId: "arrabelle", listingName: "Arrabelle", hasMention: true, hasDirectLink: true, meaningfulBodyMentions: 2 }),
      ],
    });

    expect(output.classification.primary_type).toBe("Comparison");
    expect(output.classification.intent_labels).toContain("Compare");
    expect(output.classification.selection_value).toBe("Very High");
  });

  it("classifies listing support using dominant listing scoring", () => {
    const output = classifyBlogPost({
      postId: "blog-2",
      title: "Why Austria Haus is the best ski stay",
      h1: "Austria Haus in Vail",
      intro: "Austria Haus is our top recommendation.",
      bodyText: "Book Austria Haus today. We recommend Austria Haus for ski access.",
      listingRelationships: [
        rel({
          listingId: "austria-haus",
          listingName: "Austria Haus",
          hasMention: true,
          hasDirectLink: true,
          hasReciprocalLink: true,
          appearsInTitle: true,
          appearsInH1OrIntro: true,
          meaningfulBodyMentions: 3,
          recommendationOrCtaFavoring: true,
          conclusionReinforces: true,
        }),
        rel({ listingId: "arrabelle", listingName: "Arrabelle", hasMention: true, meaningfulBodyMentions: 1 }),
      ],
    });

    expect(output.classification.primary_type).toBe("Listing Support");
    expect(output.classification.dominant_listing_id).toBe("austria-haus");
    expect(output.classification.flywheel_status_by_target.find((row) => row.target_entity_id === "austria-haus")?.status).toBe("Selection Asset");
  });

  it("classifies pillar posts for broad category guides", () => {
    const output = classifyBlogPost({
      postId: "blog-3",
      title: "Best places to stay in Vail: complete guide",
      h1: "Vail stay guide",
      intro: "Discover where to stay in Vail.",
      bodyText: "This guide covers options, types of stays, and an overview of neighborhoods.",
      listingRelationships: [
        rel({ listingId: "a", listingName: "A", hasMention: true, meaningfulBodyMentions: 1 }),
        rel({ listingId: "b", listingName: "B", hasMention: true, meaningfulBodyMentions: 1 }),
      ],
    });

    expect(output.classification.primary_type).toBe("Pillar");
    expect(output.classification.parent_pillar_id).toBeNull();
  });

  it("classifies cluster posts and assigns parent pillar id", () => {
    const output = classifyBlogPost({
      postId: "blog-4",
      title: "Family weekend lodging checklist in Vail",
      h1: "Family-focused Vail stays",
      intro: "Focused on family needs.",
      bodyText: "This subtopic is specific to family planning for weekend travel logistics.",
      listingRelationships: [
        rel({ listingId: "a", listingName: "A", hasMention: true, meaningfulBodyMentions: 1 }),
        rel({ listingId: "b", listingName: "B", hasMention: true, meaningfulBodyMentions: 1 }),
      ],
    });

    expect(output.classification.primary_type).toBe("Cluster");
    expect(output.classification.parent_pillar_id).toMatch(/^pillar:/);
  });

  it("classifies proof posts when trust signals dominate", () => {
    const output = classifyBlogPost({
      postId: "blog-5",
      title: "Local awards and reviews for Vail stays",
      h1: "Trusted by locals",
      intro: "Verified reviews and credibility details.",
      bodyText: "Review data, award outcomes, and testimonials from locals prove trust.",
      listingRelationships: [rel({ listingId: "a", listingName: "A", hasMention: true })],
    });

    expect(output.classification.primary_type).toBe("Proof");
    expect(output.classification.intent_labels).toContain("Trust");
  });

  it("classifies mention for incidental listing references", () => {
    const output = classifyBlogPost({
      postId: "blog-6",
      title: "Travel notes from Vail",
      h1: "Neighborhood walk",
      intro: "A short local snapshot.",
      bodyText: "We passed by Austria Haus during our route.",
      listingRelationships: [rel({ listingId: "austria-haus", listingName: "Austria Haus", hasMention: true, meaningfulBodyMentions: 1 })],
    });

    expect(output.classification.primary_type).toBe("Mention");
    expect(output.classification.confidence).toBe("Low");
  });

  it("falls back to needs review when no deterministic signal is available", () => {
    const output = classifyBlogPost({
      postId: "blog-7",
      title: "",
      h1: "",
      intro: "",
      bodyText: "",
      listingRelationships: [],
    });

    expect(output.classification.primary_type).toBe("Needs Review");
    expect(output.classification.selection_value).toBe("Low");
  });

  it("assigns deterministic flywheel statuses", () => {
    const output = classifyBlogPost({
      postId: "blog-8",
      title: "A focused listing recommendation",
      h1: "Featured listing",
      intro: "One listing stands out.",
      bodyText: "Book now.",
      listingRelationships: [
        rel({
          listingId: "primary",
          listingName: "Primary",
          hasMention: true,
          hasDirectLink: true,
          hasReciprocalLink: true,
          appearsInTitle: true,
          appearsInH1OrIntro: true,
          meaningfulBodyMentions: 2,
          recommendationOrCtaFavoring: true,
          conclusionReinforces: true,
        }),
        rel({ listingId: "secondary", listingName: "Secondary", hasMention: true, hasDirectLink: false }),
      ],
    });

    const byTarget = new Map(output.classification.flywheel_status_by_target.map((item) => [item.target_entity_id, item.status]));
    expect(byTarget.get("primary")).toBe("Selection Asset");
    expect(byTarget.get("secondary")).toBe("Mention Only");
  });

  it("emits concise human-readable classification reasons", () => {
    const output = classifyBlogPost({
      postId: "blog-9",
      title: "A vs B",
      h1: "Comparison",
      intro: "Compare options",
      bodyText: "which is better",
      listingRelationships: [
        rel({ listingId: "a", listingName: "A", hasMention: true }),
        rel({ listingId: "b", listingName: "B", hasMention: true }),
      ],
    });

    expect(output.classification.classification_reason.length).toBeGreaterThan(20);
    expect(output.classification.classification_reason).toMatch(/Assigned/);
  });
});
