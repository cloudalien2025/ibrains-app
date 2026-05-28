export type HubFeedControlSource = {
  marketplace: "Walmart" | "eBay" | "Amazon" | "Shopify";
  sourceLabel: string;
  sourceRoute: string;
  optimizedFeedStatus:
    | "Ready to sync"
    | "Sync pending"
    | "Synced to Hub"
    | "Needs review"
    | "Canonicalization pending"
    | "Publication review required";
  lastSyncStatus: string;
  productsReadyForHub: number;
  productsNeedingReview: number;
  canonicalizationReadiness: string;
  publicationEligibility: string;
  routingReadiness: string;
  trustComplianceReview: string;
  nextAction: string;
};

export const hubFeedControlSources: HubFeedControlSource[] = [
  {
    marketplace: "Walmart",
    sourceLabel: "EcomViper/Walmart",
    sourceRoute: "/optiwal",
    optimizedFeedStatus: "Synced to Hub",
    lastSyncStatus: "Synced 12m ago (demo)",
    productsReadyForHub: 124,
    productsNeedingReview: 9,
    canonicalizationReadiness: "Ready",
    publicationEligibility: "Publication review required",
    routingReadiness: "Ready with review",
    trustComplianceReview: "Needs review",
    nextAction: "Review 9 records before publication queue.",
  },
  {
    marketplace: "eBay",
    sourceLabel: "EcomViper/eBay",
    sourceRoute: "/optibay",
    optimizedFeedStatus: "Ready to sync",
    lastSyncStatus: "Awaiting first sync in this shell",
    productsReadyForHub: 58,
    productsNeedingReview: 14,
    canonicalizationReadiness: "Canonicalization pending",
    publicationEligibility: "Needs review",
    routingReadiness: "Pending canonical merge",
    trustComplianceReview: "Review queued",
    nextAction: "Run first private Hub sync and resolve merge conflicts.",
  },
  {
    marketplace: "Amazon",
    sourceLabel: "EcomViper/Amazon",
    sourceRoute: "/optizon",
    optimizedFeedStatus: "Sync pending",
    lastSyncStatus: "Scheduled sync window (demo)",
    productsReadyForHub: 42,
    productsNeedingReview: 11,
    canonicalizationReadiness: "Pending source intake",
    publicationEligibility: "Blocked until canonicalized",
    routingReadiness: "Pending publication policy",
    trustComplianceReview: "Verification pending",
    nextAction: "Complete intake and trust verification checks.",
  },
  {
    marketplace: "Shopify",
    sourceLabel: "EcomViper/Shopify",
    sourceRoute: "/ecomviper/shopify",
    optimizedFeedStatus: "Synced to Hub",
    lastSyncStatus: "Synced 34m ago (demo)",
    productsReadyForHub: 93,
    productsNeedingReview: 6,
    canonicalizationReadiness: "Ready",
    publicationEligibility: "Ready for publication review",
    routingReadiness: "Ready",
    trustComplianceReview: "Low-risk checks pending",
    nextAction: "Approve low-risk records for publication review.",
  },
];

export const hubCanonicalizationQueuePreview = [
  {
    canonicalProduct: "Daily Immunity Gummies 60ct",
    sourceMarketplaces: "Walmart + Shopify",
    status: "Deduplication review required",
    operatorAction: "Confirm canonical identity and merged attributes.",
  },
  {
    canonicalProduct: "Hydration Electrolyte Powder Lemon",
    sourceMarketplaces: "Amazon + eBay",
    status: "Canonicalization pending",
    operatorAction: "Resolve flavor/size mismatch before publication.",
  },
  {
    canonicalProduct: "Plant Protein Vanilla 2lb",
    sourceMarketplaces: "Walmart + Amazon + Shopify",
    status: "Ready for visibility approval",
    operatorAction: "Approve public-safe summary and offer routing policy.",
  },
] as const;

export const hubPublicationReadinessPreview = [
  {
    label: "Canonical records queued",
    value: "17",
    detail: "Awaiting publication eligibility review.",
  },
  {
    label: "Needs trust/compliance review",
    value: "9",
    detail: "Publication blocked until trust checks are approved.",
  },
  {
    label: "Routing-ready offers",
    value: "26",
    detail: "Eligible after visibility and publication approval.",
  },
] as const;
