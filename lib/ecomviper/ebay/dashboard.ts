import { createEbayInventoryProvider } from "@/lib/ecomviper/ebay/ebay-inventory-provider";
import { createEbayTaxonomyProvider } from "@/lib/ecomviper/ebay/ebay-taxonomy-provider";
import { scoreEbayListing } from "@/lib/ecomviper/ebay/listing-score";
import { buildEbayRecommendation } from "@/lib/ecomviper/ebay/recommendations";
import type {
  EbayDashboardConnectionSummary,
  EbayInventoryImportResult,
  EbayListingAuditRow,
  EbayListingRecord,
} from "@/lib/ecomviper/ebay/types";

const DEFAULT_IMPORT_PAGE = 1;
const DEFAULT_IMPORT_LIMIT = 200;

export async function importEbayListingsForPhase1(
  connection: EbayDashboardConnectionSummary
): Promise<EbayInventoryImportResult> {
  const provider = createEbayInventoryProvider({ connection });
  return provider.importInventoryItems({
    marketplaceId: connection.marketplace,
    page: DEFAULT_IMPORT_PAGE,
    limit: DEFAULT_IMPORT_LIMIT,
  });
}

export async function buildEbayListingAuditRows(
  listings: EbayListingRecord[],
  connection: EbayDashboardConnectionSummary
): Promise<EbayListingAuditRow[]> {
  const taxonomyProvider = createEbayTaxonomyProvider({ connection });

  return Promise.all(
    listings.map(async (listing) => {
      const taxonomy = await taxonomyProvider.getItemAspectsForCategory(listing.categoryId);
      const score = scoreEbayListing(listing, taxonomy);
      const recommendation = buildEbayRecommendation(listing, score);
      return {
        listing,
        score,
        recommendation,
      };
    })
  );
}
