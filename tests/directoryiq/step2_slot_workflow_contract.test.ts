import { describe, expect, it } from "vitest";
import {
  derivePublishDisabledReason,
  deriveStep2AggregateState,
  step2SummaryCopy,
} from "@/lib/directoryiq/step2SlotWorkflowContract";

describe("step2 slot workflow contract", () => {
  it("derives create_ready deterministically", () => {
    expect(
      deriveStep2AggregateState({
        draft_status: "not_started",
        image_status: "not_started",
        review_status: "not_ready",
        publish_status: "not_started",
        blog_to_listing_link_status: "not_started",
        listing_to_blog_link_status: "not_started",
      })
    ).toBe("create_ready");
  });

  it("derives preview_ready when both assets are ready and review is ready", () => {
    expect(
      deriveStep2AggregateState({
        draft_status: "ready",
        image_status: "ready",
        review_status: "ready",
        publish_status: "not_started",
        blog_to_listing_link_status: "not_started",
        listing_to_blog_link_status: "not_started",
      })
    ).toBe("preview_ready");
  });

  it("derives approved when both assets are ready and review is approved", () => {
    expect(
      deriveStep2AggregateState({
        draft_status: "ready",
        image_status: "ready",
        review_status: "approved",
        publish_status: "not_started",
        blog_to_listing_link_status: "not_started",
        listing_to_blog_link_status: "not_started",
      })
    ).toBe("approved");
  });

  it("keeps needs_attention while preserving asset readiness on later publish failure", () => {
    expect(
      deriveStep2AggregateState({
        draft_status: "ready",
        image_status: "ready",
        review_status: "approved",
        publish_status: "failed",
        blog_to_listing_link_status: "not_started",
        listing_to_blog_link_status: "not_started",
      })
    ).toBe("needs_attention");
  });

  it("exposes exact publish disabled reason copy", () => {
    expect(
      derivePublishDisabledReason({
        draftReady: true,
        imageReady: true,
        approved: false,
        publishing: false,
        published: false,
        integrationsReady: true,
        listingIdentityResolved: true,
      })
    ).toBe("Approve this draft before publishing.");
  });

  it("maps exact summary copy for preview_ready", () => {
    expect(step2SummaryCopy("preview_ready")).toBe("Draft and featured image are ready for review.");
  });
});
