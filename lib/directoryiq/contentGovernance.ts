import type { PostType } from "@/lib/directoryiq/selectionEngine";

export type DraftValidation = {
  valid: boolean;
  errors: string[];
  hasContextualListingLink: boolean;
};

const FABRICATION_PATTERN = /\b(#1|number\s*1|award-winning|five-star rated by everyone|guaranteed results|certified by .* without source)\b/i;
const CLICK_HERE_PATTERN = /<a[^>]*>\s*click here\s*<\/a>/i;

export function postTypeLabel(postType: PostType): string {
  if (postType === "comparison") return "Comparison";
  if (postType === "best_of") return "Best of";
  if (postType === "contextual_guide") return "Contextual guide";
  return "Persona/intent guide";
}

export function buildGovernedPrompt(input: {
  postType: PostType;
  listingTitle: string;
  listingUrl?: string;
  listingDescription: string;
  focusTopic: string;
  researchPack?: Array<{
    position?: number;
    title?: string;
    link?: string;
    snippet?: string;
  }>;
}): string {
  const researchLines =
    Array.isArray(input.researchPack) && input.researchPack.length > 0
      ? [
          "Research Pack (Top 10 organic results):",
          ...input.researchPack.slice(0, 10).map((row, idx) => {
            return `${idx + 1}. ${row.title ?? ""} | ${row.link ?? ""} | ${row.snippet ?? ""}`.trim();
          }),
          "Use the research pack only for framing and topic completeness. Do not quote or invent facts not present in listing data.",
        ]
      : ["Research Pack: unavailable (proceed with listing data only)."];
  const listingUrl = typeof input.listingUrl === "string" ? input.listingUrl.trim() : "";
  const enforceLink = listingUrl.length > 0;

  return [
    "Write a production-ready authority support blog draft.",
    "STRICT RULES:",
    "1) No fabrication. Use only provided listing data.",
    "2) Do not invent ratings, awards, years, stats, credentials, testimonials.",
    "3) Neutral analytical tone. No hype/sales copy.",
    enforceLink
      ? "4) Must include at least one contextual in-body link to the listing URL."
      : "4) Listing URL unavailable: do not invent one; skip listing hyperlink requirement.",
    "5) No anchor stuffing, no click-here anchors, no footer-only link.",
    "6) Keep 900-1400 words.",
    `Post type: ${postTypeLabel(input.postType)}.`,
    `Focus topic: ${input.focusTopic}.`,
    `Listing title: ${input.listingTitle}.`,
    `Listing URL: ${listingUrl || "unavailable"}.`,
    "Listing data:",
    input.listingDescription,
    ...researchLines,
    "Return HTML only (no markdown fences).",
  ].join("\n");
}

export function validateDraftHtml(params: {
  html: string;
  listingUrl?: string;
}): DraftValidation {
  const errors: string[] = [];
  const html = params.html;

  if (!html || html.trim().length < 400) {
    errors.push("Draft is too short.");
  }

  if (FABRICATION_PATTERN.test(html)) {
    errors.push("Draft contains potential fabricated or promotional claims.");
  }

  if (CLICK_HERE_PATTERN.test(html)) {
    errors.push("Draft contains prohibited click-here anchor text.");
  }

  const listingUrl = typeof params.listingUrl === "string" ? params.listingUrl.trim() : "";
  let hasContextualListingLink = false;
  if (listingUrl) {
    const linkPattern = new RegExp(`<a[^>]+href=["']${escapeRegExp(listingUrl)}["'][^>]*>(.*?)<\\/a>`, "i");
    const contextualPattern = /<p[^>]*>[^<]{20,}<a[^>]+href=["'][^"']+["'][^>]*>[^<]+<\/a>[^<]{20,}<\/p>/i;

    const hasListingLink = linkPattern.test(html);
    hasContextualListingLink = hasListingLink && contextualPattern.test(html);

    if (!hasContextualListingLink) {
      errors.push("Draft must include a contextual in-body blog-to-listing hyperlink.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    hasContextualListingLink,
  };
}

export function buildImagePrompt(input: {
  focusTopic: string;
  imageStylePreference: string;
}): string {
  return [
    `Editorial featured image for: ${input.focusTopic}.`,
    `Style preference: ${input.imageStylePreference}.`,
    "Subtle overlay text with the focus topic is allowed.",
    "No exaggerated claims, fake badges, fake awards, or misleading visuals.",
    "Clean, modern, publication-ready composition.",
  ].join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
