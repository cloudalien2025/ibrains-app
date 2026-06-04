import type { NormalizedSupplierIntelligenceRecord } from "@/lib/ecomviper/suppliers/rocktomic/supplier-intelligence-schema";

export interface SupplierFactsReadModelProjection {
  sku: string;
  productName: string | null;
  supplementFacts: {
    servingSize: string | null;
    servingsPerContainer: string | null;
    activeIngredients: string[];
    amountPerServing: string[];
    amount_per_serving: string[];
    active_ingredients: string[];
    nutrientFacts: string[];
  };
    sourceFactsUsed: Array<{
      sourceType: string;
      sourceUrl: string;
      confidence: number;
      status: "structured" | "partial" | "image_text_only" | "missing" | "needs_review";
    }>;
}

function toAmountText(name: string, amount: number | null, unit: string | null): string {
  if (amount == null) return name;
  return `${name} ${amount}${unit || ""}`.trim();
}

export function toSupplierFactsReadModelProjection(
  record: NormalizedSupplierIntelligenceRecord
): SupplierFactsReadModelProjection {
  const activeIngredients = record.activeIngredients.map((entry) => toAmountText(entry.name, entry.amount, entry.unit));
  const nutrientFacts = record.nutrientFacts.map((entry) => toAmountText(entry.name, entry.amount, entry.unit));
  const amountPerServing = [
    ...record.activeIngredients.map((entry) => toAmountText(entry.name, entry.amount, entry.unit)),
    ...record.nutrientFacts.map((entry) => toAmountText(entry.name, entry.amount, entry.unit)),
  ].filter(Boolean);

  return {
    sku: record.sku,
    productName: record.productName,
    supplementFacts: {
      servingSize: record.servingSize,
      servingsPerContainer: record.servingsPerContainer == null ? null : String(record.servingsPerContainer),
      activeIngredients,
      amountPerServing,
      amount_per_serving: amountPerServing,
      active_ingredients: activeIngredients,
      nutrientFacts,
    },
    sourceFactsUsed: record.provenance.map((entry) => ({
      sourceType: entry.sourceType,
      sourceUrl: entry.sourceUrl,
      confidence: entry.confidence,
      status: record.sourceStatus,
    })),
  };
}
