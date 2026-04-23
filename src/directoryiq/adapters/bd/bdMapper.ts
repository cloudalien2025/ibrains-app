import { ListingFacts } from "@/src/directoryiq/domain/types";

export function mapBdListingToFacts(listingId: string, source: Record<string, unknown>): ListingFacts {
  const title =
    (typeof source.group_name === "string" && source.group_name) ||
    (typeof source.title === "string" && source.title) ||
    listingId;
  const description =
    (typeof source.group_desc === "string" && source.group_desc) ||
    (typeof source.short_description === "string" && source.short_description) ||
    (typeof source.description === "string" && source.description) ||
    "";
  const url = typeof source.url === "string" ? source.url : null;
  return {
    listingId,
    title,
    url,
    description,
    raw: source,
    allowedFacts: {
      category: source.group_category ?? source.category ?? null,
      location: source.post_location ?? source.location ?? source.city ?? null,
      phone: source.phone ?? source.phone1 ?? null,
      email: source.email ?? null,
      website: source.website ?? null,
      average_rating: source.average_rating ?? source.rating ?? null,
      review_count: source.review_count ?? source.reviews_count ?? null,
    },
  };
}
