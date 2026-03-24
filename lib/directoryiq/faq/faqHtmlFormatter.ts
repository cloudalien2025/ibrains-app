import type { FaqEntry, ListingFaqContext } from "@/lib/directoryiq/faq/types";

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hasInternalJargonTitle(title: string): boolean {
  return /(pre[\s_-]*selection|friction|slot|mission control|publish_)/i.test(title);
}

function buildFaqTitle(context: ListingFaqContext): string {
  const listingName = context.listing_name.trim() || "Listing";
  if (context.city.trim()) return `${listingName} in ${context.city.trim()} Traveler FAQ`;
  if (context.region.trim()) return `${listingName} ${context.region.trim()} Traveler FAQ`;
  return `${listingName} Traveler FAQ`;
}

export function formatFaqHtml(input: {
  context: ListingFaqContext;
  faqEntries: FaqEntry[];
}): string {
  const rawTitle = (input.context.title || "").trim();
  const title = rawTitle && !hasInternalJargonTitle(rawTitle) ? rawTitle : buildFaqTitle(input.context);
  const intro =
    "Direct answers to common traveler questions about " +
    input.context.listing_name +
    (input.context.city ? " in " + input.context.city : "") +
    ".";

  const faqBlocks = input.faqEntries.map((entry) => {
    return [
      "<section class=\"faq-item\">",
      "  <h2>" + htmlEscape(entry.question) + "</h2>",
      "  " + entry.answer_html,
      "</section>",
    ].join("\n");
  });

  const links = Array.from(new Set(input.faqEntries.flatMap((entry) => entry.internal_links))).filter(Boolean);
  const linksSection =
    links.length > 0
      ? [
          "<section class=\"faq-links\">",
          "  <h2>Related links</h2>",
          "  <ul>",
          ...links.map((link) => "    <li><a href=\"" + htmlEscape(link) + "\">" + htmlEscape(link) + "</a></li>"),
          "  </ul>",
          "</section>",
        ].join("\n")
      : "";

  return [
    "<article class=\"listing-faq-support\">",
    "  <h1>" + htmlEscape(title) + "</h1>",
    "  <p>" + htmlEscape(intro) + "</p>",
    ...faqBlocks,
    "  <p>Review policy, logistics, and amenity details with the listing before booking.</p>",
    linksSection,
    "</article>",
  ]
    .filter(Boolean)
    .join("\n");
}
