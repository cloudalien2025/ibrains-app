export type Step2DraftStatus = "not_started" | "generating" | "ready" | "failed";
export type Step2ImageStatus = "not_started" | "generating" | "ready" | "failed";
export type Step2ReviewStatus = "not_ready" | "ready" | "approved";
export type Step2PublishStatus = "not_started" | "publishing" | "published" | "failed";
export type Step2LinkStatus = "not_started" | "linked" | "failed";

export type Step2AggregateState =
  | "create_ready"
  | "generating"
  | "draft_ready"
  | "image_ready"
  | "preview_ready"
  | "approved"
  | "publishing"
  | "published"
  | "needs_attention";

export type Step2WorkflowDomainState = {
  draft_status: Step2DraftStatus;
  image_status: Step2ImageStatus;
  review_status: Step2ReviewStatus;
  publish_status: Step2PublishStatus;
  blog_to_listing_link_status: Step2LinkStatus;
  listing_to_blog_link_status: Step2LinkStatus;
  published_url?: string | null;
};

export function deriveStep2AggregateState(input: Step2WorkflowDomainState): Step2AggregateState {
  const anyFailed =
    input.draft_status === "failed" ||
    input.image_status === "failed" ||
    input.publish_status === "failed" ||
    input.blog_to_listing_link_status === "failed" ||
    input.listing_to_blog_link_status === "failed";

  if (input.publish_status === "published") {
    const linksSatisfied =
      input.blog_to_listing_link_status === "linked" && input.listing_to_blog_link_status === "linked";
    if (input.published_url && linksSatisfied) return "published";
    return "needs_attention";
  }

  if (input.publish_status === "publishing") return "publishing";
  if (anyFailed) return "needs_attention";
  if (input.draft_status === "not_started" && input.image_status === "not_started") return "create_ready";
  if (input.draft_status === "generating" || input.image_status === "generating") return "generating";
  if (input.draft_status === "ready" && input.image_status !== "ready") return "draft_ready";
  if (input.image_status === "ready" && input.draft_status !== "ready") return "image_ready";

  if (input.draft_status === "ready" && input.image_status === "ready") {
    if (input.review_status === "approved" && input.publish_status === "not_started") return "approved";
    if (input.review_status === "ready" && input.publish_status === "not_started") return "preview_ready";
  }

  return "needs_attention";
}

export function step2SummaryCopy(state: Step2AggregateState): string {
  if (state === "create_ready") return "This support article has not been generated yet.";
  if (state === "generating") return "Creating article draft and featured image…";
  if (state === "draft_ready") return "Draft is ready for review. Featured image is still pending.";
  if (state === "image_ready") return "Featured image is ready. Article draft is still pending.";
  if (state === "preview_ready") return "Draft and featured image are ready for review.";
  if (state === "approved") return "Assets are approved and ready to publish.";
  if (state === "publishing") return "Publishing article and completing reciprocal linking…";
  if (state === "published") return "Article is live and linked.";
  return "Needs attention before this article can be completed.";
}

export function derivePublishDisabledReason(input: {
  draftReady: boolean;
  imageReady: boolean;
  approved: boolean;
  publishing: boolean;
  published: boolean;
  integrationsReady: boolean;
  listingIdentityResolved: boolean;
}): string | null {
  if (!input.integrationsReady) return "Publishing is unavailable until required integrations are connected.";
  if (!input.listingIdentityResolved) return "Publishing is unavailable until listing identity is resolved.";
  if (!input.draftReady) return "Article draft is still processing.";
  if (!input.imageReady) return "Featured image is still processing.";
  if (!input.approved) return "Approve this draft before publishing.";
  if (input.publishing || input.published) return "";
  return null;
}
