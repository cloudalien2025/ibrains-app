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
      "AI Travel Selection Engine for entity readiness, selection confidence, and authority blueprint control.",
    tags: ["Travel Entities", "Selection Index", "Authority Blueprint"],
    primaryCtaText: "Open",
    upsellTitle: "Unlock DirectoryIQ",
    upsellMessage:
      "Activate DirectoryIQ to map listing health, discover category gaps, and improve local ranking signals.",
    iconKey: "map",
  },
  {
    id: "ecomviper",
    name: "EcomViper",
    shortDescription:
      "AI Product Selection Engine for agent readiness, evidence density, and mention optimization.",
    tags: ["Product Entities", "Agent Readiness", "Selection Lab"],
    primaryCtaText: "Open",
    upsellTitle: "Unlock EcomViper",
    upsellMessage:
      "Get Shopify ingestion controls and reasoning hubs to improve product-topic authority.",
    iconKey: "zap",
  },
  {
    id: "studio",
    name: "Studio",
    shortDescription:
      "AI Narrative Selection Engine for mention probability, legibility, and consistency.",
    tags: ["Studio", "Media", "Narrative"],
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

export function brainRoute(id: BrainId): `/${BrainId}` {
  return `/${id}`;
}
