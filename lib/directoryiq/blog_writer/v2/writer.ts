import type { ListingData } from "../../types.ts";
import { getSerpCacheById } from "../../storage/serpCacheStore.ts";
import { listDraftsByListing } from "../../storage/draftStore.ts";

const scoreTitle = (title: string, keyword: string, location?: string): number => {
  let score = 0;
  const lower = title.toLowerCase();
  if (lower.startsWith(keyword.toLowerCase())) score += 3;
  if (/guide|tips|best|checklist|near/.test(lower)) score += 2;
  if (location && lower.includes(location.toLowerCase())) score += 2;
  if (title.length >= 45 && title.length <= 68) score += 2;
  if (!/!/.test(title)) score += 1;
  return score;
};

const toSlug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

const createCtrTitles = (keyword: string, location?: string): string[] => {
  const loc = location ? ` in ${location}` : "";
  return [
    `${keyword}${loc}: Practical Guide for Better Results`,
    `${keyword}${loc}: Tips to Choose the Right Option`,
    `Best ${keyword}${loc}: What to Know Before You Book`,
    `${keyword}${loc}: Checklist for First-Time Buyers`,
    `How to Compare ${keyword}${loc} Without Overpaying`,
    `${keyword}${loc}: Common Mistakes and How to Avoid Them`,
    `${keyword}${loc}: Local Tips for Faster Decisions`,
    `${keyword}${loc}: 2026 Planning Guide`,
  ];
};

const buildSeoTitle = async (keyword: string, location: string | undefined, listingId: string): Promise<string> => {
  const base = `${keyword}${location ? ` ${location}` : ""} Guide 2026`;
  const drafts = await listDraftsByListing(listingId);
  const duplicate = drafts.some((d) => d.seo_title.toLowerCase() === base.toLowerCase());
  return duplicate ? `${base} | Updated` : base;
};

const buildMetaDescription = (keyword: string, location?: string) =>
  `Discover ${keyword}${location ? ` in ${location}` : ""} with practical tips, planning guidance, and a simple next step to find the right fit.`.slice(0, 158);

const buildFallbackOutline = (keyword: string) => [
  "## Quick Answer",
  `## Core ${keyword} Considerations`,
  "## Frequently Asked Questions",
  "## Local Tips",
  "## Final Checklist",
];

export const generateDirectoryIqDraft = async (input: {
  listing: ListingData;
  focusKeyword: string;
  serpCacheId?: string | null;
}): Promise<{
  post_title: string;
  title_alternates: string[];
  article_markdown: string;
  seo_title: string;
  meta_description: string;
  slug: string;
  serp_outline_used: boolean;
  serp_cache_id: string | null;
}> => {
  const location = [input.listing.city, input.listing.state].filter(Boolean).join(", ") || undefined;
  const titles = createCtrTitles(input.focusKeyword, location)
    .map((title) => ({ title, score: scoreTitle(title, input.focusKeyword, location) }))
    .sort((a, b) => b.score - a.score);

  const chosenTitle = titles[0]?.title ?? `${input.focusKeyword} Guide`;
  const alternates = titles.slice(1, 3).map((item) => item.title);

  const serp = input.serpCacheId ? await getSerpCacheById(input.serpCacheId) : undefined;
  const hasReadySerp = serp?.status === "READY" && !!serp.consensus_outline;
  const headings = hasReadySerp
    ? serp.consensus_outline?.h2Sections.map((item) => `## ${item.heading}`) ?? []
    : buildFallbackOutline(input.focusKeyword);

  const article = [
    `# ${chosenTitle}`,
    "",
    `This guide covers ${input.focusKeyword} using only available listing context for ${input.listing.business_name}.`,
    "",
    ...headings,
    "",
    "## Related Listing",
    `Primary link: [${input.listing.business_name}](${input.listing.listing_url})`,
    `Alternate anchor: [Visit this listing page](${input.listing.listing_url})`,
    "",
    "Back-link plan: add one link from listing profile to this blog draft after publishing.",
  ].join("\n");

  return {
    post_title: chosenTitle,
    title_alternates: alternates,
    article_markdown: article,
    seo_title: await buildSeoTitle(input.focusKeyword, location, input.listing.listing_id),
    meta_description: buildMetaDescription(input.focusKeyword, location),
    slug: toSlug(`${input.focusKeyword}-${location ?? "guide"}`),
    serp_outline_used: hasReadySerp,
    serp_cache_id: hasReadySerp ? serp!.id : null,
  };
};

export const __private__ = { buildFallbackOutline };
