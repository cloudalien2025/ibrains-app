type GovernedPromptInput = {
  postType: string;
  listingTitle: string;
  listingUrl: string;
  listingDescription: string;
  focusTopic: string;
};

export function buildGovernedPrompt(input: GovernedPromptInput): string {
  return [
    `Post type: ${input.postType}`,
    `Listing title: ${input.listingTitle}`,
    `Listing URL: ${input.listingUrl}`,
    `Listing description: ${input.listingDescription}`,
    `Focus topic: ${input.focusTopic}`,
    "Requirement: include one contextual in-body link to the listing URL.",
  ].join("\n");
}

export function validateDraftHtml(input: {
  html: string;
  listingUrl: string;
}): { valid: boolean; errors: string[]; hasContextualListingLink: boolean } {
  const html = input.html ?? "";
  const listingUrl = input.listingUrl ?? "";
  const hasContextualListingLink = listingUrl.length > 0 && html.includes(listingUrl);
  const errors = hasContextualListingLink ? [] : ["Draft must include a contextual in-body link to the listing URL."];

  return {
    valid: hasContextualListingLink,
    errors,
    hasContextualListingLink,
  };
}

export function buildImagePrompt(input: { focusTopic: string; imageStylePreference?: string | null }): string {
  const style = (input.imageStylePreference ?? "editorial").trim() || "editorial";
  return `Create a featured image for topic \"${input.focusTopic}\" in ${style} style.`;
}
