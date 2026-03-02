import { ListingFacts } from "@/src/directoryiq/domain/types";

export async function getListingFacts(_userId: string, listingId: string): Promise<ListingFacts | null> {
  return {
    listingId,
    title: listingId,
    url: null,
    description: "",
    raw: {},
    allowedFacts: {},
  };
}
