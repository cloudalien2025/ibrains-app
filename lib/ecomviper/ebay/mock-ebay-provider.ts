import type {
  EbayCategoryAspectMetadata,
  EbayInventoryImportRequest,
  EbayInventoryImportResult,
  EbayInventoryProvider,
  EbayListingRecord,
  EbayTaxonomyProvider,
} from "@/lib/ecomviper/ebay/types";

export const EBAY_DEFAULT_MARKETPLACE = "EBAY_US";
export const EBAY_READ_ONLY_SCOPE = "sell.inventory.readonly";

const MOCK_EBAY_LISTINGS: EbayListingRecord[] = [
  {
    id: "ebay_mock_strong_001",
    sku: "EV-EB-STRONG-001",
    title: "PowerWave Wireless Pro Controller for Nintendo Switch OLED with Motion Controls, Turbo, and USB-C Charging",
    categoryId: "177",
    categoryName: "Video Game Accessories",
    condition: "NEW",
    quantity: 18,
    descriptionSummary:
      "Premium wireless gamepad designed for Nintendo Switch and Switch OLED with responsive joysticks, textured grip, programmable turbo, motion controls, and reliable USB-C charging. Includes pairing guidance, battery expectations, and compatibility notes for a cleaner buyer experience.",
    bulletHighlights: [
      "Switch + Switch OLED compatibility",
      "Motion controls and programmable turbo",
      "Low-latency wireless pairing",
      "USB-C charging cable included",
      "Textured anti-slip grip",
    ],
    aspects: {
      Brand: "PowerWave",
      Platform: "Nintendo Switch",
      Type: "Gamepad",
      Color: "Black",
      Connectivity: "Wireless",
      Material: "ABS Plastic",
      "Compatible Model": "Nintendo Switch OLED",
    },
    identifiers: {
      brand: "PowerWave",
      model: "PW-SW-900",
      upc: "850045112233",
      ean: "0850045112233",
      mpn: "PW-SW-900",
    },
    imageUrls: [
      "https://images.example.com/ebay/strong/1.jpg",
      "https://images.example.com/ebay/strong/2.jpg",
      "https://images.example.com/ebay/strong/3.jpg",
      "https://images.example.com/ebay/strong/4.jpg",
      "https://images.example.com/ebay/strong/5.jpg",
      "https://images.example.com/ebay/strong/6.jpg",
      "https://images.example.com/ebay/strong/7.jpg",
    ],
  },
  {
    id: "ebay_mock_medium_001",
    sku: "EV-EB-MEDIUM-001",
    title: "Wireless Switch Controller with Turbo and Rechargeable Battery",
    categoryId: "177",
    categoryName: "Video Game Accessories",
    condition: "NEW",
    quantity: 6,
    descriptionSummary:
      "Reliable wireless controller for Nintendo Switch with turbo mode and ergonomic design. Description covers basic compatibility and charging details but needs more shopper decision support.",
    bulletHighlights: [
      "Works with Nintendo Switch",
      "Rechargeable internal battery",
      "Basic turbo support",
    ],
    aspects: {
      Brand: "NovaPlay",
      Platform: "Nintendo Switch",
      Type: "Gamepad",
      Connectivity: "Wireless",
    },
    identifiers: {
      brand: "NovaPlay",
      model: "NP-SW-201",
      mpn: "NP-SW-201",
    },
    imageUrls: [
      "https://images.example.com/ebay/medium/1.jpg",
      "https://images.example.com/ebay/medium/2.jpg",
      "https://images.example.com/ebay/medium/3.jpg",
    ],
  },
  {
    id: "ebay_mock_weak_001",
    sku: "EV-EB-WEAK-001",
    title: "Game Controller",
    categoryId: "177",
    categoryName: "Video Game Accessories",
    condition: "USED",
    quantity: 0,
    descriptionSummary: "Controller for sale.",
    bulletHighlights: [],
    aspects: {
      Type: "Controller",
    },
    identifiers: {
      model: "Unknown",
    },
    imageUrls: ["https://images.example.com/ebay/weak/1.jpg"],
  },
];

const MOCK_CATEGORY_ASPECTS: Record<string, EbayCategoryAspectMetadata> = {
  "177": {
    categoryId: "177",
    categoryName: "Video Game Accessories",
    requiredAspects: ["Brand", "Platform", "Type"],
    recommendedAspects: ["Color", "Connectivity", "Material", "Compatible Model"],
  },
  "9355": {
    categoryId: "9355",
    categoryName: "Vitamins & Supplements",
    requiredAspects: ["Brand", "Formulation", "Department"],
    recommendedAspects: ["Ingredients", "Dosage", "Expiration Date", "Features"],
  },
};

function cloneListings(listings: EbayListingRecord[]): EbayListingRecord[] {
  return listings.map((listing) => ({
    ...listing,
    bulletHighlights: [...listing.bulletHighlights],
    aspects: { ...listing.aspects },
    identifiers: { ...listing.identifiers },
    imageUrls: [...listing.imageUrls],
  }));
}

export function loadDeterministicMockEbayListings(): EbayListingRecord[] {
  return cloneListings(MOCK_EBAY_LISTINGS);
}

export function getMockEbayAspectMetadata(categoryId: string): EbayCategoryAspectMetadata {
  return (
    MOCK_CATEGORY_ASPECTS[categoryId] ?? {
      categoryId,
      categoryName: "Unmapped eBay Category",
      requiredAspects: ["Brand", "Type"],
      recommendedAspects: ["Color", "Material"],
    }
  );
}

export class MockEbayInventoryProvider implements EbayInventoryProvider {
  readonly mode = "mock" as const;

  async importInventoryItems(request: EbayInventoryImportRequest): Promise<EbayInventoryImportResult> {
    void request;
    return {
      mode: "mock",
      listings: loadDeterministicMockEbayListings(),
      warnings: [
        "Mock import mode active. Phase 1 does not call live eBay endpoints.",
        "Read-only scope for future live import: sell.inventory.readonly.",
      ],
    };
  }
}

export class MockEbayTaxonomyProvider implements EbayTaxonomyProvider {
  readonly mode = "mock" as const;

  async getItemAspectsForCategory(categoryId: string): Promise<EbayCategoryAspectMetadata> {
    return getMockEbayAspectMetadata(categoryId);
  }
}

export function createMockEbayInventoryProvider(): EbayInventoryProvider {
  return new MockEbayInventoryProvider();
}

export function createMockEbayTaxonomyProvider(): EbayTaxonomyProvider {
  return new MockEbayTaxonomyProvider();
}
