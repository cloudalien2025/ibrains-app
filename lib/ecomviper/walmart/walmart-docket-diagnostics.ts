import type { WalmartDocketFieldSource } from "@/lib/ecomviper/walmart/walmart-docket-source-metadata";
import type { WalmartNormalizedDocket } from "@/lib/ecomviper/walmart/walmart-docket";
import {
  WALMART_DOCKET_BULLET_ALIASES,
  WALMART_DOCKET_IMAGE_ALIASES,
  WALMART_DOCKET_LONG_DESCRIPTION_ALIASES,
  WALMART_DOCKET_SHORT_DESCRIPTION_ALIASES,
} from "@/lib/ecomviper/walmart/walmart-docket-aliases";

interface WalmartDocketDiagnosticField {
  populated: boolean;
  source: WalmartDocketFieldSource | "unknown";
}

export interface WalmartDocketDiagnostics {
  sku: string;
  rawKeys: string[];
  aliasHits: Record<string, string[]>;
  populatedFields: string[];
  missingFields: string[];
  fieldSources: Record<string, WalmartDocketDiagnosticField>;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function isMeaningful(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return asText(value).length > 0;
}

function readPath(payload: unknown, path: string): unknown {
  const parts = path
    .split(".")
    .map((entry) => entry.trim())
    .filter(Boolean);
  let current: unknown = payload;
  for (const part of parts) {
    const objectValue = asObject(current);
    if (!objectValue) return undefined;
    current = objectValue[part];
  }
  return current;
}

function flattenKeys(payload: unknown, prefix = "", into = new Set<string>()): Set<string> {
  const objectValue = asObject(payload);
  if (!objectValue) return into;
  for (const [key, value] of Object.entries(objectValue)) {
    const path = prefix ? `${prefix}.${key}` : key;
    into.add(path);
    flattenKeys(value, path, into);
  }
  return into;
}

function aliasHits(payload: unknown, aliases: readonly string[]): string[] {
  const hits: string[] = [];
  for (const alias of aliases) {
    const value = readPath(payload, alias);
    if (typeof value === "undefined") continue;
    if (!isMeaningful(value)) continue;
    hits.push(alias);
  }
  return Array.from(new Set(hits));
}

function docketFieldSummary(docket: WalmartNormalizedDocket): Record<string, WalmartDocketDiagnosticField> {
  return {
    title: { populated: isMeaningful(docket.content.title.value), source: docket.content.title.source },
    shortDescription: {
      populated: isMeaningful(docket.content.shortDescription.value),
      source: docket.content.shortDescription.source,
    },
    longDescription: {
      populated: isMeaningful(docket.content.longDescription.value),
      source: docket.content.longDescription.source,
    },
    bullets: { populated: isMeaningful(docket.content.bullets.value), source: docket.content.bullets.source },
    primaryImage: {
      populated: isMeaningful(docket.media.primaryImage.value),
      source: docket.media.primaryImage.source,
    },
    galleryImages: {
      populated: isMeaningful(docket.media.galleryImages.value),
      source: docket.media.galleryImages.source,
    },
    price: { populated: isMeaningful(docket.pricingInventory.price.value), source: docket.pricingInventory.price.source },
    inventoryQuantity: {
      populated: isMeaningful(docket.pricingInventory.inventoryQuantity.value),
      source: docket.pricingInventory.inventoryQuantity.source,
    },
    searchBrowseAttributes: {
      populated: isMeaningful(docket.searchBrowse.attributes.value),
      source: docket.searchBrowse.attributes.source,
    },
  };
}

export function buildWalmartDocketDiagnostics(input: {
  sku: string;
  payload: unknown;
  docket: WalmartNormalizedDocket;
}): WalmartDocketDiagnostics {
  const rawKeys = Array.from(flattenKeys(input.payload)).sort((left, right) => left.localeCompare(right));
  const fieldSources = docketFieldSummary(input.docket);
  const populatedFields = Object.entries(fieldSources)
    .filter(([, entry]) => entry.populated)
    .map(([field]) => field);
  const missingFields = Object.entries(fieldSources)
    .filter(([, entry]) => !entry.populated)
    .map(([field]) => field);

  return {
    sku: input.sku,
    rawKeys,
    aliasHits: {
      shortDescription: aliasHits(input.payload, WALMART_DOCKET_SHORT_DESCRIPTION_ALIASES),
      longDescription: aliasHits(input.payload, WALMART_DOCKET_LONG_DESCRIPTION_ALIASES),
      bullets: aliasHits(input.payload, WALMART_DOCKET_BULLET_ALIASES),
      images: aliasHits(input.payload, WALMART_DOCKET_IMAGE_ALIASES),
    },
    populatedFields,
    missingFields,
    fieldSources,
  };
}
