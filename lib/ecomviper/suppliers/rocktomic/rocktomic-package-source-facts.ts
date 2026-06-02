import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { RocktomicProductRecord, SupplementFactsStatus } from "@/lib/ecomviper/suppliers/rocktomic/master-package-schema";
import { getRocktomicProduct } from "@/lib/ecomviper/suppliers/rocktomic/master-package-reader";
import type { RocktomicMasterPackage } from "@/lib/ecomviper/suppliers/rocktomic/master-package-schema";

export type PackageReadStatus = "package_found" | "package_missing" | "package_invalid";
export type PackageSkuStatus = "sku_found" | "sku_missing";

export interface PackageSkuLookupResult {
  packageReadStatus: PackageReadStatus;
  packageSkuStatus: PackageSkuStatus;
  product: RocktomicProductRecord | null;
  supplementFactsStatus: SupplementFactsStatus | null;
  activeIngredientCount: number;
  nutrientFactCount: number;
  missingDataCount: number;
  diagnostics: string[];
}

export interface PackageHydratedFacts {
  supplierSku: string;
  supplierProductName: string | null;
  activeIngredients: string[];
  ingredientAmounts: string[];
  otherIngredients: string[];
  servingSize: string | null;
  servingsPerContainer: string | null;
  warnings: string | null;
  coaUrl: string | null;
  labelTemplateAiPresent: boolean;
  mockupTemplateTifPresent: boolean;
  supplementFactsStatus: SupplementFactsStatus;
  supplementFactsMerchantText: string;
  packageReadStatus: PackageReadStatus;
  packageSkuStatus: PackageSkuStatus;
}

const PACKAGE_DIR = "data/ecomviper/suppliers/rocktomic/latest";
const PACKAGE_FILE = "rocktomic-supplier-package.json";

let cachedPackagePromise: Promise<RocktomicMasterPackage | null> | null = null;

async function loadCachedPackage(): Promise<RocktomicMasterPackage | null> {
  if (cachedPackagePromise) return cachedPackagePromise;
  cachedPackagePromise = (async () => {
    const filePath = path.join(process.cwd(), PACKAGE_DIR, PACKAGE_FILE);
    const text = await fs.readFile(filePath, "utf8").catch(() => null);
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.products)) return null;
      return parsed as RocktomicMasterPackage;
    } catch {
      return null;
    }
  })();
  return cachedPackagePromise;
}

function normalizeSku(sku: unknown): string {
  return typeof sku === "string" ? sku.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
}

export function supplementFactsStatusToMerchantText(status: SupplementFactsStatus): string {
  if (status === "structured") return "Supplement Facts extracted from supplier label.";
  if (status === "partial") return "Some ingredient details are available; review before publishing.";
  if (status === "visual_only") return "Supplement Facts panel is available, but structured details are incomplete.";
  if (status === "not_applicable") return "Supplement Facts are not applicable for this product type.";
  return "Supplement Facts are not available in the current supplier package.";
}

export async function getRocktomicPackageFactsForSku(sku: string): Promise<PackageSkuLookupResult> {
  const diagnostics: string[] = [];
  let pkg: RocktomicMasterPackage | null = null;

  try {
    pkg = await loadCachedPackage();
  } catch {
    diagnostics.push("package_file: load_error");
    return {
      packageReadStatus: "package_invalid",
      packageSkuStatus: "sku_missing",
      product: null,
      supplementFactsStatus: null,
      activeIngredientCount: 0,
      nutrientFactCount: 0,
      missingDataCount: 0,
      diagnostics,
    };
  }

  if (!pkg) {
    diagnostics.push("package_file: not_found");
    return {
      packageReadStatus: "package_missing",
      packageSkuStatus: "sku_missing",
      product: null,
      supplementFactsStatus: null,
      activeIngredientCount: 0,
      nutrientFactCount: 0,
      missingDataCount: 0,
      diagnostics,
    };
  }

  const normalizedSku = normalizeSku(sku);
  diagnostics.push(`package_file: found`);
  diagnostics.push(`package_product_count: ${pkg.products.length}`);
  diagnostics.push(`lookup_sku: ${normalizedSku}`);

  const product = getRocktomicProduct(pkg, normalizedSku);
  if (!product) {
    diagnostics.push(`package_sku_status: not_found`);
    return {
      packageReadStatus: "package_found",
      packageSkuStatus: "sku_missing",
      product: null,
      supplementFactsStatus: null,
      activeIngredientCount: 0,
      nutrientFactCount: 0,
      missingDataCount: 0,
      diagnostics,
    };
  }

  const sf = product.supplementFacts;
  const missingDataCount = Object.values(product.missingData).filter(Boolean).length;
  diagnostics.push(`package_sku_status: found`);
  diagnostics.push(`package_supplement_facts_status: ${sf.status}`);
  diagnostics.push(`package_active_ingredient_count: ${sf.activeIngredients.length}`);
  diagnostics.push(`package_nutrient_fact_count: ${sf.nutrientFacts.length}`);
  diagnostics.push(`package_missing_data_count: ${missingDataCount}`);

  return {
    packageReadStatus: "package_found",
    packageSkuStatus: "sku_found",
    product,
    supplementFactsStatus: sf.status,
    activeIngredientCount: sf.activeIngredients.length + sf.nutrientFacts.length,
    nutrientFactCount: sf.nutrientFacts.length,
    missingDataCount,
    diagnostics,
  };
}

export function mapPackageProductToHydratedFacts(product: RocktomicProductRecord): PackageHydratedFacts {
  const sf = product.supplementFacts;

  const activeIngredients = [
    ...sf.activeIngredients.map((entry) => entry.name).filter(Boolean),
    ...sf.nutrientFacts.map((entry) => entry.name).filter(Boolean),
  ];

  const ingredientAmounts = [
    ...sf.activeIngredients
      .filter((entry) => entry.amount !== null)
      .map((entry) => `${entry.name}: ${entry.amount}${entry.unit ?? ""}`.trim()),
    ...sf.nutrientFacts
      .filter((entry) => entry.amount !== null)
      .map((entry) => `${entry.name}: ${entry.amount}${entry.unit ?? ""}`.trim()),
  ];

  const otherIngredients = sf.otherIngredients.filter(Boolean);

  return {
    supplierSku: product.sku,
    supplierProductName: product.productName,
    activeIngredients,
    ingredientAmounts,
    otherIngredients,
    servingSize: sf.servingSize,
    servingsPerContainer: sf.servingsPerContainer !== null ? String(sf.servingsPerContainer) : null,
    warnings: product.warnings.length > 0 ? product.warnings.join("; ") : null,
    coaUrl: product.coaUrl,
    labelTemplateAiPresent: Boolean(product.labelTemplateUrl),
    mockupTemplateTifPresent: Boolean(product.mockupUrl),
    supplementFactsStatus: sf.status,
    supplementFactsMerchantText: supplementFactsStatusToMerchantText(sf.status),
    packageReadStatus: "package_found",
    packageSkuStatus: "sku_found",
  };
}

export function clearPackageCache(): void {
  cachedPackagePromise = null;
}
