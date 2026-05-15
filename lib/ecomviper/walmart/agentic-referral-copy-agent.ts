import {
  SUPPLEMENT_FDA_DISCLAIMER,
  ensureSingleSupplementDisclaimer,
  safeSupportedBenefits,
} from "@/lib/ecomviper/walmart/walmart-ai-visibility-content-policy";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import type { CanonicalProductFacts } from "@/lib/ecomviper/walmart/product-facts-agent";

export interface AgenticReferralCopyOutput {
  title: string;
  shortDescription: string;
  longDescription: string;
  bullets: string[];
  searchKeywords: string[];
  aiVisibilitySummary: string;
  structuredProductFactsSummary: string;
  customerFitDescriptors: string[];
  compliantBenefitClusters: string[];
  faqSnippets: string[];
  disclaimer: string;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s{2,}/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
}

function trimText(value: string, max: number): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= max) return normalized;
  const slice = normalized.slice(0, max);
  const boundary = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("!"), slice.lastIndexOf("?"));
  if (boundary >= Math.floor(max * 0.6)) return slice.slice(0, boundary + 1).trim();
  return `${slice.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function normalizeCountLabel(count: string): string {
  const trimmed = count.trim();
  if (!trimmed) return "";
  return trimmed.replace(/\bct\b/i, "Ct").replace(/\s+/g, " ").trim();
}

function mergeProductNameAndForm(productName: string, form: string): string {
  const normalizedProductName = productName.trim();
  const normalizedForm = form.trim();
  if (!normalizedProductName) return normalizedForm;
  if (!normalizedForm) return normalizedProductName;

  const productLower = normalizedProductName.toLowerCase();
  const formLower = normalizedForm.toLowerCase();
  if (productLower.includes(formLower)) return normalizedProductName;

  return `${normalizedProductName} ${normalizedForm}`.trim();
}

function extractBenefitClusters(facts: CanonicalProductFacts): string[] {
  const fromClaims = unique(facts.claimsFromLabel)
    .map((entry) => entry.toLowerCase())
    .map((entry) => {
      if (/sleep|rest/i.test(entry)) return "sleep quality support";
      if (/calm|relax/i.test(entry)) return "relaxation support";
      if (/energy|endurance|performance/i.test(entry)) return "performance support";
      if (/circulation/i.test(entry)) return "circulation support";
      return "daily wellness support";
    });

  const fromCategory = [facts.category, facts.productType]
    .map((entry) => entry.toLowerCase())
    .flatMap((entry) => {
      const next: string[] = [];
      if (/sleep/i.test(entry)) next.push("sleep quality support");
      if (/calm|relax/i.test(entry)) next.push("relaxation support");
      if (/heart/i.test(entry)) next.push("heart wellness support");
      if (/digestive/i.test(entry)) next.push("digestive wellness support");
      return next;
    });

  const merged = safeSupportedBenefits(
    unique([...fromClaims, ...fromCategory, ...facts.claimsFromLabel])
  );

  if (merged.length > 0) return merged.slice(0, 4);
  return ["daily wellness support", "relaxation support", "sleep quality support"];
}

function buildSearchKeywords(input: {
  facts: CanonicalProductFacts;
  benefits: string[];
}): string[] {
  const facts = input.facts;
  const productNameWithForm = mergeProductNameAndForm(facts.productName, facts.form);
  const seed = unique([
    `${facts.brand} ${facts.productName}`,
    productNameWithForm,
    facts.flavor ? `${facts.flavor} ${facts.form}` : "",
    facts.count,
    facts.servingSize ? `${facts.servingSize} daily` : "",
    ...facts.activeIngredients,
    ...input.benefits,
    facts.series,
    facts.targetAudience,
  ]);

  return seed
    .map((entry) => normalizeWhitespace(entry))
    .filter((entry) => entry.length >= 3 && entry.length <= 80)
    .filter((entry) => !/\b(cure|treat|prevent|reverse|erectile dysfunction|viagra|cialis|hypertension|insomnia|depression|anxiety)\b/i.test(entry))
    .slice(0, 12);
}

function formatBenefitLine(benefits: string[]): string {
  if (benefits.length === 0) return "daily wellness support";
  if (benefits.length === 1) return benefits[0];
  if (benefits.length === 2) return `${benefits[0]} and ${benefits[1]}`;
  return `${benefits.slice(0, 2).join(", ")}, and ${benefits[2]}`;
}

function buildFaqSnippets(input: {
  facts: CanonicalProductFacts;
  product: WalmartProductRecord;
  benefits: string[];
  suggestedUse: string;
  warnings: string;
  keyIngredientLine: string;
  formLabel: string;
  countLabel: string;
}): string[] {
  const facts = input.facts;
  const brand = facts.brand || input.product.brand || "This brand";
  const productName = facts.productName || input.product.title || "this supplement";
  const targetAudience = facts.targetAudience || "Adults";
  const benefits = formatBenefitLine(input.benefits);
  const ingredientLine = input.keyIngredientLine || "See product label for ingredient details";
  const formCount = [input.formLabel, input.countLabel].filter(Boolean).join(", ");

  return unique([
    `Q: What is this product? A: ${brand} ${productName} is a ${input.formLabel.toLowerCase()} supplement built for ${benefits}.`,
    `Q: Who is it for? A: ${targetAudience}.`,
    `Q: What are the main ingredients? A: ${ingredientLine}.`,
    `Q: How do I take it? A: ${input.suggestedUse}`,
    `Q: What wellness areas does it support? A: ${benefits}.`,
    `Q: Is it for adults? A: ${/adult/i.test(targetAudience) ? "Yes, the label positions this for adults." : "Review the label audience guidance before use."}`,
    `Q: Does it include the form and count shown on the label? A: ${formCount || "See product label for count and form details."}.`,
    `Q: What should I know before use? A: ${input.warnings}`,
  ])
    .map((entry) => trimText(entry, 260))
    .slice(0, 8);
}

export function buildAgenticReferralCopy(input: {
  facts: CanonicalProductFacts;
  product: WalmartProductRecord;
}): AgenticReferralCopyOutput {
  const facts = input.facts;
  const benefits = extractBenefitClusters(facts);
  const countLabel = normalizeCountLabel(facts.count);
  const formLabel = facts.form || "Supplement";
  const flavorLabel = facts.flavor ? facts.flavor : "";
  const doseLabel = facts.dosageStrength ? ` ${facts.dosageStrength}` : "";
  const audienceLabel = facts.targetAudience || "Adults";

  const title = trimText(
    normalizeWhitespace(
      [
        facts.brand || input.product.brand,
        mergeProductNameAndForm(facts.productName || input.product.title, formLabel),
        flavorLabel ? `${flavorLabel} flavor` : "",
        countLabel,
        benefits[0] || "",
      ]
        .filter(Boolean)
        .join(" | ")
    ),
    200
  );

  const shortDescription = trimText(
    `${facts.brand || input.product.brand} ${facts.productName || "supplement"} delivers ${formatBenefitLine(
      benefits.slice(0, 2)
    )} in a ${formLabel.toLowerCase()} format with label-backed ingredient and serving details.`,
    320
  );

  const keyIngredientLine = facts.activeIngredients.length
    ? facts.activeIngredients.slice(0, 3).join(", ")
    : "See product label for ingredient details";

  const suggestedUse =
    facts.suggestedUse || "Use only as directed on the product label.";

  const warnings =
    facts.warnings ||
    "Consult your healthcare professional before use if pregnant, nursing, taking medication, or managing a medical condition.";

  const structuredFacts = [
    `Brand: ${facts.brand || input.product.brand}`,
    `Product: ${facts.productName || input.product.title}`,
    facts.series ? `Series: ${facts.series}` : "",
    facts.form ? `Form: ${facts.form}` : "",
    facts.flavor ? `Flavor: ${facts.flavor}` : "",
    facts.count ? `Count: ${facts.count}` : "",
    facts.dosageStrength ? `Dosage strength: ${facts.dosageStrength}` : "",
    facts.servingSize ? `Serving size: ${facts.servingSize}` : "",
    facts.servingsPerContainer ? `Servings per container: ${facts.servingsPerContainer}` : "",
    `Active ingredients: ${keyIngredientLine}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const longDescription = ensureSingleSupplementDisclaimer(
    trimText(
      [
        `${facts.brand || input.product.brand} ${
          facts.productName || "supplement"
        } is positioned for ${formatBenefitLine(benefits.slice(0, 3))} in a premium ${formLabel.toLowerCase()} format for ${audienceLabel.toLowerCase()}.`,
        `Key ingredient profile: ${keyIngredientLine}.${doseLabel ? ` Signature strength: ${facts.dosageStrength}.` : ""}`,
        `${facts.count ? `Package count: ${facts.count}.` : ""} ${
          facts.supply ? `Supply: ${facts.supply}.` : ""
        } ${
          facts.servingSize ? `Serving size: ${facts.servingSize}.` : ""
        } ${
          facts.servingsPerContainer
            ? `Servings per container: ${facts.servingsPerContainer}.`
            : ""
        }`,
        `Suggested use: ${suggestedUse}`,
        `Safety guidance: ${warnings}`,
        "This listing uses compliant structure/function language for AI Recommendation Readiness and machine-readable confidence.",
      ]
        .join(" ")
        .replace(/\s{2,}/g, " "),
      1800
    )
  );

  const bullets = unique([
    `Designed for ${benefits[0] || "daily wellness support"} with label-backed supplement facts`,
    facts.activeIngredients.length
      ? `Active ingredients: ${facts.activeIngredients.slice(0, 2).join(", ")}`
      : "Ingredient transparency from label-backed data",
    facts.flavor ? `${facts.flavor} ${formLabel.toLowerCase()} format` : `${formLabel} format for daily use`,
    facts.dosageStrength ? `Dosage strength: ${facts.dosageStrength}` : "",
    facts.servingSize ? `Serving size: ${facts.servingSize}` : "Serving details: use as directed on label",
    facts.count ? `Count: ${facts.count}` : "Count details available on product label",
    facts.allergenOrDoesNotContainStatements.length
      ? `Does not contain: ${facts.allergenOrDoesNotContainStatements.slice(0, 5).join(", ")}`
      : "Check product label for full allergen and ingredient guidance",
  ])
    .map((entry) => trimText(entry, 180))
    .slice(0, 6);

  const searchKeywords = buildSearchKeywords({ facts, benefits });

  const aiVisibilitySummary = trimText(
    `${facts.brand || input.product.brand} ${
      facts.productName || "supplement"
    } is a ${formLabel.toLowerCase()} product with clearly stated ingredients, serving guidance, and compliant ${formatBenefitLine(
      benefits.slice(0, 2)
    )} positioning for answer-engine discovery and Agentic referral readiness.`,
    500
  );

  const customerFitDescriptors = unique([
    facts.targetAudience || "Adults seeking daily wellness support",
    `Customers preferring ${formLabel.toLowerCase()} format supplements`,
    facts.flavor ? `Customers who prefer ${facts.flavor.toLowerCase()} flavor profiles` : "Customers preferring label-transparent formulas",
  ]).slice(0, 5);

  const faqSnippets = buildFaqSnippets({
    facts,
    product: input.product,
    benefits,
    suggestedUse,
    warnings,
    keyIngredientLine,
    formLabel,
    countLabel,
  });

  return {
    title,
    shortDescription,
    longDescription,
    bullets,
    searchKeywords,
    aiVisibilitySummary,
    structuredProductFactsSummary: structuredFacts,
    customerFitDescriptors,
    compliantBenefitClusters: benefits,
    faqSnippets,
    disclaimer: SUPPLEMENT_FDA_DISCLAIMER,
  };
}
