import { aiSelectionCopy } from "@/lib/copy/aiSelectionCopy";

export const brainIds = ["directoryiq", "ecomviper", "studio"] as const;

export type BrainId = (typeof brainIds)[number];

export type BrainCatalogEntry = {
  id: BrainId;
  name: string;
  shortDescription: string;
  tags: string[];
  primaryCtaText: string;
  upsellTitle: string;
  upsellMessage: string;
  iconKey: "map" | "zap" | "clapperboard";
};

export const brainCatalog: BrainCatalogEntry[] = [
  {
    id: "directoryiq",
    name: "DirectoryIQ",
    shortDescription:
      "Travel intelligence brain for local entity readiness, authority coverage, and operational discovery cycles.",
    tags: ["Travel Entities", "Knowledge Readiness", "Authority Blueprint"],
    primaryCtaText: "Open Console",
    upsellTitle: "Unlock DirectoryIQ",
    upsellMessage:
      "Activate DirectoryIQ to map listing health, discover category gaps, and improve local ranking signals.",
    iconKey: "map",
  },
  {
    id: "ecomviper",
    name: "EcomViper",
    shortDescription:
      "Product intelligence brain focused on ingestion quality, evidence density, and retrieval confidence.",
    tags: ["Product Entities", "Evidence Density", "Retrieval Confidence"],
    primaryCtaText: "Open Console",
    upsellTitle: "Unlock EcomViper",
    upsellMessage:
      "Get Shopify ingestion controls and reasoning hubs to improve product-topic authority.",
    iconKey: "zap",
  },
  {
    id: "studio",
    name: "Studio",
    shortDescription:
      "Narrative intelligence brain for legibility, consistency, and answer quality across channels.",
    tags: ["Narrative", "Media", "Answer Quality"],
    primaryCtaText: "Unlock",
    upsellTitle: "Unlock Studio",
    upsellMessage:
      "Narrative Authority layer for DirectoryIQ and EcomViper teams. Convert entity insights into high-confidence narrative assets.",
    iconKey: "clapperboard",
  },
];

export const brainsDockCopy = aiSelectionCopy.brainsDock;

export const brainCatalogById: Record<BrainId, BrainCatalogEntry> = {
  directoryiq: brainCatalog[0],
  ecomviper: brainCatalog[1],
  studio: brainCatalog[2],
};

export function isBrainId(value: string): value is BrainId {
  return (brainIds as readonly string[]).includes(value);
}

export function brainRoute(id: BrainId): `/brains/${BrainId}` {
  return `/brains/${id}`;
}
