import type { FaqEntry, ListingFaqContext } from "@/lib/directoryiq/faq/types";

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatFaqHtml(input: {
  context: ListingFaqContext;
  faqEntries: FaqEntry[];
}): string {
  const title = input.context.title || input.context.listing_name;
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
    "  <h1>" + htmlEscape(title) + " FAQ</h1>",
    "  <p>" + htmlEscape(intro) + "</p>",
    ...faqBlocks,
    "  <p>Review policy, logistics, and amenity details with the listing before booking.</p>",
    linksSection,
    "</article>",
  ]
    .filter(Boolean)
    .join("\n");
}
