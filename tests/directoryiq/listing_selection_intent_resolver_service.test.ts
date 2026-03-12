import { describe, expect, it } from "vitest";
import { resolveListingSelectionIntent } from "@/src/directoryiq/services/listingSelectionIntentResolverService";

const supportSkeleton = {
  summary: {
    inboundLinkedSupportCount: 0,
    mentionWithoutLinkCount: 0,
    outboundSupportLinkCount: 0,
    connectedSupportPageCount: 0,
    lastGraphRunAt: null,
  },
  inboundLinkedSupport: [],
  mentionsWithoutLinks: [],
  outboundSupportLinks: [],
  connectedSupportPages: [],
} as const;

const gapsSkeleton = {
  summary: {
    totalGaps: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    evaluatedAt: "2026-03-12T00:00:00.000Z",
    lastGraphRunAt: null,
    dataStatus: "no_meaningful_gaps" as const,
  },
  items: [],
} as const;

const actionsSkeleton = {
  summary: {
    totalActions: 0,
    highPriorityCount: 0,
    mediumPriorityCount: 0,
    lowPriorityCount: 0,
    evaluatedAt: "2026-03-12T00:00:00.000Z",
    dataStatus: "no_major_actions_recommended" as const,
  },
  items: [],
} as const;

const flywheelSkeleton = {
  summary: {
    totalRecommendations: 0,
    highPriorityCount: 0,
    mediumPriorityCount: 0,
    lowPriorityCount: 0,
    evaluatedAt: "2026-03-12T00:00:00.000Z",
    dataStatus: "no_major_flywheel_opportunities" as const,
  },
  items: [],
} as const;

describe("listing selection intent resolver service", () => {
  it("returns the required Wave 2 Task 5 intent contract", () => {
    const result = resolveListingSelectionIntent({
      listing: {
        id: "29",
        title: "Annapurna Nepali and Indian Cuisine",
        canonicalUrl: null,
        siteId: "site-1",
      },
      listingContext: {
        title: "Annapurna Nepali and Indian Cuisine",
        city: "Vail",
      },
      support: {
        listing: { id: "29", title: "Annapurna Nepali and Indian Cuisine", canonicalUrl: null, siteId: "site-1" },
        ...supportSkeleton,
      },
      gaps: {
        listing: { id: "29", title: "Annapurna Nepali and Indian Cuisine", canonicalUrl: null, siteId: "site-1" },
        ...gapsSkeleton,
      },
      actions: {
        listing: { id: "29", title: "Annapurna Nepali and Indian Cuisine", canonicalUrl: null, siteId: "site-1" },
        ...actionsSkeleton,
      },
      flywheel: {
        listing: { id: "29", title: "Annapurna Nepali and Indian Cuisine", canonicalUrl: null, siteId: "site-1" },
        ...flywheelSkeleton,
      },
    });

    expect(result.primaryIntent).toBeDefined();
    expect(result.secondaryIntents.length).toBeGreaterThan(0);
    expect(result.targetEntities.length).toBeGreaterThan(0);
    expect(result.supportingEntities.length).toBeGreaterThan(0);
    expect(Array.isArray(result.localModifiers)).toBe(true);
    expect(result.comparisonFrames.length).toBeGreaterThan(0);
    expect(result.clusterPriorityRanking.length).toBe(4);
  });

  it("produces materially different intent outputs for distinct listing types", () => {
    const listing3 = resolveListingSelectionIntent({
      listing: { id: "3", title: "\"Onion\" playground In Lionshead Square", canonicalUrl: null, siteId: "site-1" },
      listingContext: { title: "\"Onion\" playground In Lionshead Square" },
      support: { listing: { id: "3", title: "\"Onion\" playground In Lionshead Square", canonicalUrl: null, siteId: "site-1" }, ...supportSkeleton },
      gaps: { listing: { id: "3", title: "\"Onion\" playground In Lionshead Square", canonicalUrl: null, siteId: "site-1" }, ...gapsSkeleton },
      actions: { listing: { id: "3", title: "\"Onion\" playground In Lionshead Square", canonicalUrl: null, siteId: "site-1" }, ...actionsSkeleton },
      flywheel: { listing: { id: "3", title: "\"Onion\" playground In Lionshead Square", canonicalUrl: null, siteId: "site-1" }, ...flywheelSkeleton },
    });

    const listing6 = resolveListingSelectionIntent({
      listing: { id: "6", title: "A 1 Reservations", canonicalUrl: null, siteId: "site-1" },
      listingContext: { title: "A 1 Reservations" },
      support: { listing: { id: "6", title: "A 1 Reservations", canonicalUrl: null, siteId: "site-1" }, ...supportSkeleton },
      gaps: { listing: { id: "6", title: "A 1 Reservations", canonicalUrl: null, siteId: "site-1" }, ...gapsSkeleton },
      actions: { listing: { id: "6", title: "A 1 Reservations", canonicalUrl: null, siteId: "site-1" }, ...actionsSkeleton },
      flywheel: { listing: { id: "6", title: "A 1 Reservations", canonicalUrl: null, siteId: "site-1" }, ...flywheelSkeleton },
    });

    const listing29 = resolveListingSelectionIntent({
      listing: { id: "29", title: "Annapurna Nepali and Indian Cuisine", canonicalUrl: null, siteId: "site-1" },
      listingContext: { title: "Annapurna Nepali and Indian Cuisine" },
      support: { listing: { id: "29", title: "Annapurna Nepali and Indian Cuisine", canonicalUrl: null, siteId: "site-1" }, ...supportSkeleton },
      gaps: { listing: { id: "29", title: "Annapurna Nepali and Indian Cuisine", canonicalUrl: null, siteId: "site-1" }, ...gapsSkeleton },
      actions: { listing: { id: "29", title: "Annapurna Nepali and Indian Cuisine", canonicalUrl: null, siteId: "site-1" }, ...actionsSkeleton },
      flywheel: { listing: { id: "29", title: "Annapurna Nepali and Indian Cuisine", canonicalUrl: null, siteId: "site-1" }, ...flywheelSkeleton },
    });

    expect(listing3.primaryIntent).not.toBe(listing29.primaryIntent);
    expect(listing6.primaryIntent).not.toBe(listing29.primaryIntent);
    expect(listing3.comparisonFrames[0]).not.toBe(listing29.comparisonFrames[0]);
    expect(listing6.targetEntities.join("|")).not.toBe(listing29.targetEntities.join("|"));
  });
});
