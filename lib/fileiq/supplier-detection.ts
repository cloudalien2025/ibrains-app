const UNKNOWN_SUPPLIER = "Unknown Supplier";
const ROCKTOMIC_SUPPLIER = "Rocktomic Labs LLC";

export interface SupplierDetectionInput {
  explicitSupplierName?: string | null;
  fileNames?: string[];
  contentHints?: string[];
  urls?: string[];
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isUnknownSupplier(value: string | null): boolean {
  if (!value) return true;
  return value.toLowerCase() === UNKNOWN_SUPPLIER.toLowerCase();
}

function hasRocktomicSignal(haystack: string): boolean {
  const lower = haystack.toLowerCase();
  if (lower.includes("rocktomic")) return true;
  return /\bROC\d{2,}\b/i.test(haystack);
}

export function detectSupplierName(input: SupplierDetectionInput): string {
  const explicit = clean(input.explicitSupplierName);
  if (!isUnknownSupplier(explicit)) return explicit!;

  const haystack = [
    ...(input.fileNames ?? []),
    ...(input.contentHints ?? []),
    ...(input.urls ?? []),
  ].join("\n");

  if (hasRocktomicSignal(haystack)) return ROCKTOMIC_SUPPLIER;
  return UNKNOWN_SUPPLIER;
}

export function supplierIdFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

export function extractSupplierNameFromPayload(payload: Record<string, unknown>): string | null {
  const supplier = payload.supplier;
  if (!supplier || typeof supplier !== "object" || Array.isArray(supplier)) return null;
  const record = supplier as Record<string, unknown>;
  return clean(record.name) ?? clean(record.supplierName) ?? null;
}

export { UNKNOWN_SUPPLIER, ROCKTOMIC_SUPPLIER };
