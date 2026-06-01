import {
  PRODUCT_COPYWRITING_OUTPUT_JSON_SCHEMA,
  type ProductCopywritingInput,
} from "@/lib/ecomviper/copywriting-agent/copywriting-agent-types";

export interface ProductCopywritingPromptContract {
  systemInstruction: string;
  sourceFactsSummary: string;
  complianceConstraints: string[];
  agenticVisibilityGoals: string[];
  outputInstruction: string;
  outputJsonSchema: typeof PRODUCT_COPYWRITING_OUTPUT_JSON_SCHEMA;
}

function asList(label: string, values: string[]): string {
  if (!values.length) return `${label}: none`;
  return `${label}: ${values.join("; ")}`;
}

function boolLabel(label: string, value: boolean): string {
  return `${label}: ${value ? "yes" : "no"}`;
}

export function buildProductCopywritingPromptContract(input: ProductCopywritingInput): ProductCopywritingPromptContract {
  const sourceFactsSummary = [
    `Product: ${input.productIdentity.title}`,
    `Channel: ${input.productIdentity.channel}`,
    `Supplier match: ${input.supplierContext.matchStatus}`,
    asList("Active ingredients", input.supplementFacts.activeIngredients),
    asList("Ingredient amounts", input.supplementFacts.ingredientAmounts),
    asList("Other ingredients", input.supplementFacts.otherIngredients),
    `Serving size: ${input.supplementFacts.servingSize || "missing"}`,
    `Servings per container: ${input.supplementFacts.servingsPerContainer || "missing"}`,
    boolLabel("COA present", input.sourceEvidence.coaPresent),
    `COA URL: ${input.sourceEvidence.coaUrl || "missing"}`,
    boolLabel("Label evidence present", input.sourceEvidence.labelEvidencePresent),
    boolLabel("Supplement facts image present", input.sourceEvidence.supplementFactsImagePresent),
    boolLabel("AI label text evidence present", input.sourceEvidence.aiLabelTextEvidencePresent),
    `AI label text status: ${input.sourceEvidence.aiLabelTextEvidenceStatus || "none"}`,
    boolLabel("Structured supplement facts present", input.sourceEvidence.structuredSupplementFactsPresent),
    boolLabel("Pricing missing", input.missingData.pricingMissing),
    boolLabel("Inventory missing", input.missingData.inventoryMissing),
    boolLabel("Supplement facts missing", input.missingData.supplementFactsMissing),
    boolLabel("Serving size missing", input.missingData.servingSizeMissing),
    boolLabel("Servings per container missing", input.missingData.servingsPerContainerMissing),
    boolLabel("Ingredient amounts missing", input.missingData.ingredientAmountsMissing),
    boolLabel("Supplier match missing", input.missingData.supplierMatchMissing),
    asList("Allowed source facts", input.sourceEvidence.sourceFactsUsed),
  ].join("\n");

  const complianceConstraints = [
    "Do not invent ingredients, dosages, serving sizes, certifications, COA links, pricing, inventory, or supplier status.",
    "Do not use disease claims, treatment claims, cure claims, or drug comparison language.",
    "If a fact is missing, emit explicit missingDataNotices instead of guessing.",
    "Use only source-backed supplement structure/function language.",
    "If COA is missing, state a plain missing notice and do not imply verification.",
    "If pricing or inventory is missing, state plain missing notices and do not fabricate values.",
  ];

  const agenticVisibilityGoals = [
    "Provide clear product identity, form, count, and use-case framing when available.",
    "Use comparison-friendly attributes grounded in source facts.",
    "Provide FAQ suggestions that improve answer-engine retrieval and shopper clarity.",
    "Keep trust signals transparent and sourced.",
  ];

  const outputInstruction = [
    "Return only JSON matching ProductCopywritingOutput schema.",
    "Every required field must be present.",
    "Set qualityScores fields from 0-100 based on grounded quality.",
    "If source facts are missing or partial, populate missingDataNotices with plain notices like 'COA missing', 'Pricing missing', 'Serving size missing', 'Servings per container missing', 'Ingredient amounts missing', 'Supplement Facts image available; ingredient details are not structured yet.', 'Supplement Facts text needs review.', or 'Supplier match not found'.",
  ].join(" ");

  return {
    systemInstruction: [
      "You are an ecommerce copywriting agent for all products across Shopify and future channels.",
      "You must stay strictly source-grounded and compliance-safe.",
      "Never fabricate facts.",
      outputInstruction,
    ].join(" "),
    sourceFactsSummary,
    complianceConstraints,
    agenticVisibilityGoals,
    outputInstruction,
    outputJsonSchema: PRODUCT_COPYWRITING_OUTPUT_JSON_SCHEMA,
  };
}

export function buildCopywritingPromptPayload(input: ProductCopywritingInput): {
  system: string;
  user: string;
  outputJsonSchema: typeof PRODUCT_COPYWRITING_OUTPUT_JSON_SCHEMA;
} {
  const contract = buildProductCopywritingPromptContract(input);
  const user = [
    "SOURCE FACTS:",
    contract.sourceFactsSummary,
    "",
    "COMPLIANCE CONSTRAINTS:",
    ...contract.complianceConstraints.map((line) => `- ${line}`),
    "",
    "AGENTIC VISIBILITY GOALS:",
    ...contract.agenticVisibilityGoals.map((line) => `- ${line}`),
    "",
    `OUTPUT INSTRUCTION: ${contract.outputInstruction}`,
  ].join("\n");

  return {
    system: contract.systemInstruction,
    user,
    outputJsonSchema: contract.outputJsonSchema,
  };
}
