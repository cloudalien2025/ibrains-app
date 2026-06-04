import "server-only";

import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";
import { getLatestFileIqResolvedProductBySupplierAndSku } from "@/lib/fileiq/fileiq-reconciliation";

type JsonRecord = Record<string, unknown>;

export interface FileIqProductEditorContext {
  matched: boolean;
  supplierId: string | null;
  supplierName: string | null;
  supplierSku: string | null;
  generatedAt: string | null;
  completenessScore: number | null;
  completenessLabel: string;
  readyForEcomViper: boolean;
  warnings: string[];
  sourceUpdatedAt: string | null;
  inventoryAccessLevel: string | null;
  shipsFrom: string | null;
  processingTime: string | null;
  shippingTime: string | null;
  returnPolicy: string | null;
}

export interface FileIqSourceFactsPatch {
  supplementFactsText: string | null;
  activeIngredients: string[];
  amountPerServing: string[];
  otherIngredients: string | null;
  servingSize: string | null;
  servingsPerContainer: string | null;
  keyProductFeatures: string[];
  certifications: string[];
  manufacturingClaims: string[];
  warnings: string | null;
  suggestedUse: string | null;
  inventoryStatus: string | null;
  inventoryAccessLevel: string | null;
  msrp: number | null;
  wholesaleCost: number | null;
  currency: string | null;
  coaUrl: string | null;
  labelTemplateUrl: string | null;
  mockupUrl: string | null;
  shipsFrom: string | null;
  processingTime: string | null;
  shippingTime: string | null;
  returnPolicy: string | null;
  generatedAt: string | null;
  warningsList: string[];
}

export interface FileIqProductEditorHydration {
  context: FileIqProductEditorContext;
  patch: FileIqSourceFactsPatch | null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function normalizeSku(value: unknown): string {
  return (asString(value) ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map((entry) => asString(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const number = asNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }
  return null;
}

function buildSupplementFactsText(product: JsonRecord): string | null {
  const supplementFacts = asRecord(product.supplementFacts) ?? {};
  const ingredients = asArray(supplementFacts.ingredients)
    .map((entry) => asRecord(entry))
    .filter((entry): entry is JsonRecord => Boolean(entry))
    .map((entry) => {
      const name = asString(entry.name);
      const amount = asString(entry.amount);
      const unit = asString(entry.unit);
      if (!name) return null;
      return [name, amount ? `${amount}${unit ?? ""}` : null].filter(Boolean).join(" ");
    })
    .filter((entry): entry is string => Boolean(entry));

  const lines = [
    asString(supplementFacts.servingSize) ? `Serving Size: ${asString(supplementFacts.servingSize)}` : null,
    asString(supplementFacts.servingsPerContainer)
      ? `Servings Per Container: ${asString(supplementFacts.servingsPerContainer)}`
      : null,
    ...ingredients,
  ].filter((entry): entry is string => Boolean(entry));

  return lines.length > 0 ? lines.join(" | ") : firstString(supplementFacts.raw);
}

function buildAmountPerServing(product: JsonRecord): string[] {
  const supplementFacts = asRecord(product.supplementFacts) ?? {};
  return asArray(supplementFacts.ingredients)
    .map((entry) => asRecord(entry))
    .filter((entry): entry is JsonRecord => Boolean(entry))
    .map((entry) => {
      const name = asString(entry.name);
      const amount = asString(entry.amount);
      const unit = asString(entry.unit);
      if (!name || !amount) return null;
      return `${name} ${amount}${unit ?? ""}`.trim();
    })
    .filter((entry): entry is string => Boolean(entry));
}

function buildFeatureList(product: JsonRecord): string[] {
  const details = asRecord(product.details) ?? {};
  const values = [
    details.shortDescription,
    details.description,
    product.category,
    product.subcategory,
  ];
  return uniqueStrings(values).slice(0, 4);
}

function computeShippingFields(product: JsonRecord): Pick<FileIqSourceFactsPatch, "shipsFrom" | "processingTime" | "shippingTime" | "returnPolicy"> {
  const shipping = asRecord(product.shipping) ?? {};
  const policy = asRecord(product.policy) ?? {};
  const standardRoute = asRecord(shipping.standardRoute) ?? {};
  const totalEstimatedDays = firstNumber(standardRoute.totalEstimatedDays, standardRoute.fulfillmentDays, standardRoute.transitDays);
  return {
    shipsFrom: [asString(shipping.shipsFromState), asString(shipping.shipsFromCountry)].filter(Boolean).join(", ") || null,
    processingTime:
      firstNumber(standardRoute.fulfillmentDays) !== null
        ? `${firstNumber(standardRoute.fulfillmentDays)} day${firstNumber(standardRoute.fulfillmentDays) === 1 ? "" : "s"}`
        : null,
    shippingTime:
      totalEstimatedDays !== null
        ? `${totalEstimatedDays} day${totalEstimatedDays === 1 ? "" : "s"}`
        : null,
    returnPolicy: firstString(policy.policyNotes, policy.refundType),
  };
}

export async function getFileIqHydrationForShopifyProduct(input: {
  product: ShopifyProductRecord;
  supplierId?: string | null;
}): Promise<FileIqProductEditorHydration> {
  const supplierId = asString(input.supplierId) || "rocktomic-labs-llc";
  const variants = input.product.variants || [];
  const skuCandidates = Array.from(new Set(variants.map((variant) => normalizeSku(variant.sku)).filter(Boolean)));

  for (const sku of skuCandidates) {
    const resolved = await getLatestFileIqResolvedProductBySupplierAndSku(supplierId, sku).catch(() => null);
    if (!resolved) continue;

    const completeness = asRecord(resolved.metadata.completenessBySku)?.[sku];
    const completenessRecord = asRecord(completeness) ?? {};
    const details = asRecord(resolved.product.details) ?? {};
    const pricing = asRecord(resolved.product.pricing) ?? {};
    const inventory = asRecord(resolved.product.inventory) ?? {};
    const assets = asRecord(resolved.product.assets) ?? {};
    const shippingFields = computeShippingFields(resolved.product);
    const sourceUpdatedAt = asString(asRecord(resolved.product.extraction)?.extractedAt) || resolved.metadata.generatedAt;
    const supplier = resolved.catalog.supplier as unknown as JsonRecord | null;

    return {
      context: {
        matched: true,
        supplierId,
        supplierName: firstString(supplier?.supplierName, supplier?.name),
        supplierSku: sku,
        generatedAt: resolved.metadata.generatedAt,
        completenessScore: firstNumber(completenessRecord.score),
        completenessLabel:
          completenessRecord.readyForEcomViper === true
            ? "Ready for EcomViper"
            : "Partial FileIQ coverage",
        readyForEcomViper: completenessRecord.readyForEcomViper === true,
        warnings: uniqueStrings([completenessRecord.warnings]),
        sourceUpdatedAt,
        inventoryAccessLevel: firstString(inventory.accessLevel),
        shipsFrom: shippingFields.shipsFrom,
        processingTime: shippingFields.processingTime,
        shippingTime: shippingFields.shippingTime,
        returnPolicy: shippingFields.returnPolicy,
      },
      patch: {
        supplementFactsText: buildSupplementFactsText(resolved.product),
        activeIngredients: asArray(asRecord(resolved.product.supplementFacts)?.ingredients)
          .map((entry) => asString(asRecord(entry)?.name))
          .filter((entry): entry is string => Boolean(entry)),
        amountPerServing: buildAmountPerServing(resolved.product),
        otherIngredients: firstString(asRecord(resolved.product.supplementFacts)?.otherIngredients),
        servingSize: firstString(asRecord(resolved.product.supplementFacts)?.servingSize),
        servingsPerContainer: firstString(asRecord(resolved.product.supplementFacts)?.servingsPerContainer),
        keyProductFeatures: buildFeatureList(resolved.product),
        certifications: uniqueStrings([details.certifications, asRecord(resolved.product.agenticVisibility)?.certifications]),
        manufacturingClaims: uniqueStrings([details.certifications]),
        warnings: firstString(details.warnings),
        suggestedUse: firstString(details.suggestedUse),
        inventoryStatus: firstString(inventory.status),
        inventoryAccessLevel: firstString(inventory.accessLevel),
        msrp: firstNumber(pricing.msrp),
        wholesaleCost: firstNumber(pricing.wholesaleCost),
        currency: firstString(pricing.currency) ?? "USD",
        coaUrl: firstString(details.coaUrl, asArray(assets.coaUrls)[0]),
        labelTemplateUrl: firstString(asArray(assets.labelUrls)[0]),
        mockupUrl: null,
        shipsFrom: shippingFields.shipsFrom,
        processingTime: shippingFields.processingTime,
        shippingTime: shippingFields.shippingTime,
        returnPolicy: shippingFields.returnPolicy,
        generatedAt: resolved.metadata.generatedAt,
        warningsList: uniqueStrings([details.warnings, completenessRecord.warnings]),
      },
    };
  }

  return {
    context: {
      matched: false,
      supplierId,
      supplierName: null,
      supplierSku: null,
      generatedAt: null,
      completenessScore: null,
      completenessLabel: "No FileIQ match",
      readyForEcomViper: false,
      warnings: [],
      sourceUpdatedAt: null,
      inventoryAccessLevel: null,
      shipsFrom: null,
      processingTime: null,
      shippingTime: null,
      returnPolicy: null,
    },
    patch: null,
  };
}
