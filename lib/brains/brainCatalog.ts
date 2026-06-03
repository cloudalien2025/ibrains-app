import { aiSelectionCopy } from "@/lib/copy/aiSelectionCopy";

export const brainIds = [
  "ecomviper",
  "optibay",
  "optiwal",
  "optizon",
  "directoryiq",
  "casaflix",
  "pagebolt",
  "reelify",
  "ipetzo",
  "fileiq",
] as const;

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

export type BrainViewEntry = Omit<BrainCatalogEntry, "id"> & {
  id: string;
};

export const brainCatalog: BrainCatalogEntry[] = [
  {
    id: "ecomviper",
    name: "EcomViper",
    shortDescription:
      "Product intelligence brain focused on ingestion quality, evidence density, and retrieval confidence.",
    tags: ["Product Entities", "Evidence Density", "Retrieval Confidence"],
    primaryCtaText: "Open Brain",
    upsellTitle: "Unlock EcomViper",
    upsellMessage:
      "Get Shopify ingestion controls and reasoning hubs to improve product-topic authority.",
    iconKey: "zap",
  },
  {
    id: "optibay",
    name: "OptiBay",
    shortDescription:
      "Standalone eBay optimization brain for listing quality, ranking confidence, and conversion performance.",
    tags: ["eBay", "Listing Optimization", "Marketplace Performance"],
    primaryCtaText: "Open Brain",
    upsellTitle: "Unlock OptiBay",
    upsellMessage:
      "Activate OptiBay to optimize eBay listings with AI-assisted content and workflow controls.",
    iconKey: "zap",
  },
  {
    id: "optiwal",
    name: "OptiWal",
    shortDescription:
      "Standalone Walmart optimization brain for catalog readiness, feed reliability, and AI-assisted optimization.",
    tags: ["Walmart", "Catalog Readiness", "AI Optimization"],
    primaryCtaText: "Open Brain",
    upsellTitle: "Unlock OptiWal",
    upsellMessage:
      "Activate OptiWal to improve Walmart listing quality and operational execution.",
    iconKey: "zap",
  },
  {
    id: "optizon",
    name: "OptiZon",
    shortDescription:
      "Standalone Amazon optimization brain for listing clarity, content quality, and marketplace growth readiness.",
    tags: ["Amazon", "Content Quality", "Marketplace Readiness"],
    primaryCtaText: "Open Brain",
    upsellTitle: "Unlock OptiZon",
    upsellMessage:
      "Activate OptiZon to optimize Amazon listing operations with dedicated brain workflows.",
    iconKey: "zap",
  },
  {
    id: "directoryiq",
    name: "DirectoryIQ",
    shortDescription:
      "Brilliant Directories intelligence brain for listing readiness, authority coverage, and operational discovery cycles.",
    tags: ["Directory Intelligence", "Knowledge Readiness", "Authority Blueprint"],
    primaryCtaText: "Open Brain",
    upsellTitle: "Unlock DirectoryIQ",
    upsellMessage:
      "Activate DirectoryIQ to map listing health, discover category gaps, and improve local ranking signals.",
    iconKey: "map",
  },
  {
    id: "casaflix",
    name: "CasaFlix",
    shortDescription:
      "Standalone media brain for campaign planning, script generation, and production-ready video workflows.",
    tags: ["Campaigns", "Video Workflow", "Narrative Operations"],
    primaryCtaText: "Open Brain",
    upsellTitle: "Unlock CasaFlix",
    upsellMessage:
      "Activate CasaFlix to run end-to-end campaign intelligence and content production workflows.",
    iconKey: "clapperboard",
  },
  {
    id: "pagebolt",
    name: "SiteForge",
    shortDescription:
      "Standalone website intelligence brain for briefs, strategy, and build-ready page generation.",
    tags: ["Website Strategy", "Build Workflows", "Publishing Automation"],
    primaryCtaText: "Open Brain",
    upsellTitle: "Unlock SiteForge",
    upsellMessage:
      "Activate SiteForge to plan and generate high-performing web experiences from one brain workspace.",
    iconKey: "map",
  },
  {
    id: "reelify",
    name: "Reelify",
    shortDescription:
      "Standalone video execution brain for AI-assisted script, media plan, and publishing workflows.",
    tags: ["Narrative", "Media", "Answer Quality"],
    primaryCtaText: "Open Brain",
    upsellTitle: "Unlock Reelify",
    upsellMessage:
      "Activate Reelify to orchestrate listing-driven video pipelines and publishing operations.",
    iconKey: "clapperboard",
  },
  {
    id: "ipetzo",
    name: "iPetzo",
    shortDescription:
      "Standalone pet-industry intelligence brain for niche workflows, automation, and operational support.",
    tags: ["Vertical Intelligence", "Automation", "Pet Ecosystem"],
    primaryCtaText: "Open Brain",
    upsellTitle: "Unlock iPetzo",
    upsellMessage:
      "Activate iPetzo to launch pet-focused intelligence workflows in an independent brain workspace.",
    iconKey: "clapperboard",
  },
  {
    id: "fileiq",
    name: "FileIQ",
    shortDescription:
      "Internal file-intelligence brain for ingesting supplier source files and extracting canonical product facts.",
    tags: ["Ingestion", "Supplier Facts", "Data Provenance"],
    primaryCtaText: "Open Brain",
    upsellTitle: "FileIQ Internal Brain",
    upsellMessage:
      "Access the internal file ingestion pipeline for supplier source files and canonical product facts.",
    iconKey: "zap",
  },
];

export const brainsDockCopy = aiSelectionCopy.brainsDock;

export const brainCatalogById: Record<BrainId, BrainCatalogEntry> = {
  ecomviper: brainCatalog[0],
  optibay: brainCatalog[1],
  optiwal: brainCatalog[2],
  optizon: brainCatalog[3],
  directoryiq: brainCatalog[4],
  casaflix: brainCatalog[5],
  pagebolt: brainCatalog[6],
  reelify: brainCatalog[7],
  ipetzo: brainCatalog[8],
  fileiq: brainCatalog[9],
};

export function isBrainId(value: string): value is BrainId {
  return (brainIds as readonly string[]).includes(value);
}

const canonicalBrainRoutes: Record<BrainId, `/${string}`> = {
  ecomviper: "/ecomviper",
  optibay: "/optibay",
  optiwal: "/optiwal",
  optizon: "/optizon",
  directoryiq: "/directoryiq",
  casaflix: "/casaflix",
  pagebolt: "/pagebolt",
  reelify: "/reelify",
  ipetzo: "/ipetzo",
  fileiq: "/fileiq",
};

const brainRouteAliases: Record<string, BrainId> = {
  brilliant_directories: "directoryiq",
  ebay: "optibay",
  ebay_optimizer: "optibay",
  walmart: "optiwal",
  walmart_optimizer: "optiwal",
  amazon: "optizon",
  amazon_optimizer: "optizon",
  siteforge: "pagebolt",
  uapforge: "reelify",
  studio: "casaflix",
};

function normalizeRouteId(id: string): string {
  return id.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function brainRoute(id: string): `/${string}` {
  const normalized = normalizeRouteId(id);
  const canonicalId = isBrainId(normalized)
    ? normalized
    : (brainRouteAliases[normalized] ?? null);
  if (canonicalId) {
    return canonicalBrainRoutes[canonicalId];
  }

  return `/brains/${encodeURIComponent(id)}`;
}
