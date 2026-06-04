import fs from "node:fs/promises";
import path from "node:path";
import type { RocktomicMasterPackage, RocktomicProductRecord, PricingTiers } from "@/lib/ecomviper/suppliers/rocktomic/master-package-schema";

const DEFAULT_PACKAGE_DIR = "data/ecomviper/suppliers/rocktomic/latest";
const PACKAGE_FILE = "rocktomic-supplier-package.json";

export interface PriceResolution {
  sku: string;
  tier: string;
  price: number | null;
  resolvedFrom: "tier" | "wholesaleCost" | "msrp" | "none";
  currency: string;
}

export interface MissingDataSummary {
  totalProducts: number;
  missingProductName: number;
  missingCategory: number;
  missingPricing: number;
  missingMsrp: number;
  missingInventory: number;
  missingCoaUrl: number;
  missingLabelTemplateUrl: number;
  missingMockupUrl: number;
  missingSupplementFacts: number;
  missingProvenance: number;
}

export async function readRocktomicSupplierPackage(packageDir?: string): Promise<RocktomicMasterPackage> {
  const dir = packageDir ?? path.join(process.cwd(), DEFAULT_PACKAGE_DIR);
  const filePath = path.join(dir, PACKAGE_FILE);
  const text = await fs.readFile(filePath, "utf8");
  return JSON.parse(text) as RocktomicMasterPackage;
}

export function getRocktomicProduct(pkg: RocktomicMasterPackage, sku: string): RocktomicProductRecord | null {
  const normalizedSku = sku.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
  return pkg.products.find((p) => p.sku === normalizedSku) ?? null;
}

const TIER_FALLBACK_ORDER: Array<keyof PricingTiers> = ["t1", "t4", "t5", "t2", "t3", "t6", "t7"];

export function resolvePrice(pkg: RocktomicMasterPackage, sku: string, tier?: string): PriceResolution {
  const product = getRocktomicProduct(pkg, sku);
  const currency = product?.pricing.currency ?? "USD";
  const resolveNone = (): PriceResolution => ({ sku, tier: tier ?? "none", price: null, resolvedFrom: "none", currency });

  if (!product) return resolveNone();

  const tierKey = tier?.toLowerCase() as keyof PricingTiers | undefined;
  if (tierKey && tierKey in product.pricing.tiers) {
    const tierPrice = product.pricing.tiers[tierKey];
    if (tierPrice !== null && tierPrice !== undefined) {
      return { sku, tier: tierKey, price: tierPrice, resolvedFrom: "tier", currency };
    }
  }

  for (const fallbackTier of TIER_FALLBACK_ORDER) {
    const price = product.pricing.tiers[fallbackTier];
    if (price !== null && price !== undefined) {
      return { sku, tier: fallbackTier, price, resolvedFrom: "tier", currency };
    }
  }

  if (product.pricing.wholesaleCost !== null) {
    return { sku, tier: tier ?? "wholesale", price: product.pricing.wholesaleCost, resolvedFrom: "wholesaleCost", currency };
  }

  if (product.pricing.msrp !== null) {
    return { sku, tier: tier ?? "msrp", price: product.pricing.msrp, resolvedFrom: "msrp", currency };
  }

  return resolveNone();
}

export function getMissingDataSummary(pkg: RocktomicMasterPackage): MissingDataSummary {
  const summary: MissingDataSummary = {
    totalProducts: pkg.products.length,
    missingProductName: 0,
    missingCategory: 0,
    missingPricing: 0,
    missingMsrp: 0,
    missingInventory: 0,
    missingCoaUrl: 0,
    missingLabelTemplateUrl: 0,
    missingMockupUrl: 0,
    missingSupplementFacts: 0,
    missingProvenance: 0,
  };

  for (const product of pkg.products) {
    const m = product.missingData;
    if (m.productName) summary.missingProductName += 1;
    if (m.category) summary.missingCategory += 1;
    if (m.pricing) summary.missingPricing += 1;
    if (m.msrp) summary.missingMsrp += 1;
    if (m.inventory) summary.missingInventory += 1;
    if (m.coaUrl) summary.missingCoaUrl += 1;
    if (m.labelTemplateUrl) summary.missingLabelTemplateUrl += 1;
    if (m.mockupUrl) summary.missingMockupUrl += 1;
    if (m.supplementFacts) summary.missingSupplementFacts += 1;
    if (m.provenance) summary.missingProvenance += 1;
  }

  return summary;
}
