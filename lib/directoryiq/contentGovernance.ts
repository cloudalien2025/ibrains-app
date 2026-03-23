type GovernedPromptInput = {
  postType: string;
  listingTitle: string;
  listingUrl: string;
  listingDescription: string;
  focusTopic: string;
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/&#x22;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
}

function canonicalUrl(value: string): string {
  const normalized = decodeHtmlEntities(value).trim();
  if (!normalized) return "";
  try {
    return new URL(normalized).toString();
  } catch {
    return normalized;
  }
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hasListingAnchorLink(html: string, listingUrl: string): boolean {
  const target = canonicalUrl(listingUrl);
  if (!target) return false;

  const hrefRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null = hrefRegex.exec(html);
  while (match) {
    const href = match[1];
    if (canonicalUrl(href) === target) return true;
    match = hrefRegex.exec(html);
  }
  return false;
}

export function buildGovernedPrompt(input: GovernedPromptInput): string {
  return [
    `Post type: ${input.postType}`,
    `Listing title: ${input.listingTitle}`,
    `Listing URL: ${input.listingUrl}`,
    `Listing description: ${input.listingDescription}`,
    `Focus topic: ${input.focusTopic}`,
    "Requirement: include one contextual in-body HTML link to the listing URL using an anchor tag (<a href=\"LISTING_URL\">...).",
  ].join("\n");
}

export function validateDraftHtml(input: {
  html: string;
  listingUrl: string;
}): { valid: boolean; errors: string[]; hasContextualListingLink: boolean } {
  const html = input.html ?? "";
  const listingUrl = (input.listingUrl ?? "").trim();
  const hasContextualListingLink = hasListingAnchorLink(html, listingUrl);
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
  if (hasListingAnchorLink(html, listingUrl)) return html;

  const listingTitle = (input.listingTitle ?? "").trim() || "this listing";
  const focusTopic = (input.focusTopic ?? "").trim() || "this topic";
  const sentence = `For ${htmlEscape(focusTopic)}, see <a href="${htmlEscape(listingUrl)}">${htmlEscape(listingTitle)}</a>.`;
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
