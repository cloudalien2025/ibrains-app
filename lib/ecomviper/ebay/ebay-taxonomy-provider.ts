import type { EbayCategoryAspectMetadata, EbayDashboardConnectionSummary, EbayTaxonomyProvider } from "@/lib/ecomviper/ebay/types";
import { createMockEbayTaxonomyProvider, getMockEbayAspectMetadata } from "@/lib/ecomviper/ebay/mock-ebay-provider";

// Live taxonomy seam for future getItemAspectsForCategory integration.
export class LiveReadonlyEbayTaxonomyProvider implements EbayTaxonomyProvider {
  readonly mode = "live-ready" as const;

  constructor(private readonly _connection: EbayDashboardConnectionSummary) {}

  async getItemAspectsForCategory(categoryId: string): Promise<EbayCategoryAspectMetadata> {
    return {
      ...getMockEbayAspectMetadata(categoryId),
      categoryName: `${getMockEbayAspectMetadata(categoryId).categoryName} (taxonomy live seam disabled in Phase 1)`,
    };
  }
}

interface CreateEbayTaxonomyProviderArgs {
  connection: EbayDashboardConnectionSummary;
}

export function createEbayTaxonomyProvider({ connection }: CreateEbayTaxonomyProviderArgs): EbayTaxonomyProvider {
  if (connection.mode === "mock") {
    return createMockEbayTaxonomyProvider();
  }
  return new LiveReadonlyEbayTaxonomyProvider(connection);
}
