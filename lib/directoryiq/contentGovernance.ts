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

export function ensureContextualListingLink(input: {
  html: string;
  listingUrl: string;
  listingTitle: string;
  focusTopic: string;
}): string {
  const html = input.html ?? "";
  const listingUrl = (input.listingUrl ?? "").trim();
  if (!listingUrl) return html;
  if (html.includes(listingUrl)) return html;

  const listingTitle = (input.listingTitle ?? "").trim() || "this listing";
  const focusTopic = (input.focusTopic ?? "").trim() || "this topic";
  const sentence = `For ${focusTopic}, see [${listingTitle}](${listingUrl}).`;
  const normalized = html.trim();
  if (!normalized) return sentence;

  if (/<(p|div|article|section|main|body)\b/i.test(normalized)) {
    return `${normalized}\n<p>${sentence}</p>`;
  }
  return `${normalized}\n\n${sentence}`;
}

export function buildImagePrompt(input: { focusTopic: string; imageStylePreference?: string | null }): string {
  const style = (input.imageStylePreference ?? "editorial").trim() || "editorial";
  return `Create a featured image for topic \"${input.focusTopic}\" in ${style} style.`;
}
