import {
  SUPPLEMENT_FDA_DISCLAIMER,
  ensureSingleSupplementDisclaimer,
  safeSupportedBenefits,
} from "@/lib/ecomviper/walmart/walmart-ai-visibility-content-policy";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import type { CanonicalProductFacts } from "@/lib/ecomviper/walmart/product-facts-agent";
import {
  faqThresholdMet,
  sanitizeCustomerFacingList,
  sanitizeCustomerFacingText,
  shouldBlockGenericFaqAnswer,
} from "@/lib/ecomviper/walmart/walmart-truth-guard";

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
  return `${normalized.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function normalizeCountLabel(count: string): string {
  const trimmed = sanitizeCustomerFacingText(count);
  if (!trimmed) return "";
  return trimmed.replace(/\bct\b/i, "Ct").replace(/\s+/g, " ").trim();
}

function mergeProductNameAndForm(productName: string, form: string): string {
  const normalizedProductName = sanitizeCustomerFacingText(productName);
  const normalizedForm = sanitizeCustomerFacingText(form);
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
      if (/immune/i.test(entry)) return "immune support";
      if (/digestive|gut/i.test(entry)) return "digestive wellness support";
      return "";
    })
    .filter(Boolean);

  const fromCategory = [facts.category, facts.productType]
    .map((entry) => entry.toLowerCase())
    .flatMap((entry) => {
      const next: string[] = [];
      if (/sleep/i.test(entry)) next.push("sleep quality support");
      if (/calm|relax/i.test(entry)) next.push("relaxation support");
      if (/heart/i.test(entry)) next.push("heart wellness support");
      if (/digestive/i.test(entry)) next.push("digestive wellness support");
      if (/immune/i.test(entry)) next.push("immune support");
      return next;
    });

  const merged = safeSupportedBenefits(unique([...fromClaims, ...fromCategory, ...facts.claimsFromLabel]));
  return sanitizeCustomerFacingList(merged).slice(0, 4);
}

function buildSearchKeywords(input: { facts: CanonicalProductFacts; benefits: string[] }): string[] {
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
  ]).map((entry) => sanitizeCustomerFacingText(entry));

  return seed
    .map((entry) => normalizeWhitespace(entry))
    .filter((entry) => entry.length >= 3 && entry.length <= 80)
    .filter(
      (entry) =>
        !/\b(cure|treat|prevent|reverse|erectile dysfunction|viagra|cialis|hypertension|insomnia|depression|anxiety)\b/i.test(
          entry
        )
    )
    .slice(0, 12);
}

function formatBenefitLine(benefits: string[]): string {
  if (benefits.length === 0) return "";
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
  const brand = sanitizeCustomerFacingText(facts.brand || input.product.brand);
  const productName = sanitizeCustomerFacingText(
    facts.productName || facts.productType || facts.category || input.product.title
  );
  const targetAudience = sanitizeCustomerFacingText(facts.targetAudience || "Adults");
  const benefits = formatBenefitLine(input.benefits);
  const formCount = [sanitizeCustomerFacingText(input.formLabel), sanitizeCustomerFacingText(input.countLabel)]
    .filter(Boolean)
    .join(", ");

  const thresholdMet = faqThresholdMet({
    productName,
    productType: sanitizeCustomerFacingText(facts.productType || facts.category),
    brand,
    form: sanitizeCustomerFacingText(input.formLabel),
    mainIngredients: sanitizeCustomerFacingList(facts.activeIngredients),
    servingSize: sanitizeCustomerFacingText(facts.servingSize),
    servingsPerContainer: sanitizeCustomerFacingText(facts.servingsPerContainer),
    suggestedUse: sanitizeCustomerFacingText(facts.suggestedUse),
    supportAreas: sanitizeCustomerFacingList(input.benefits),
  });

  if (!thresholdMet) return [];

  const candidateSnippets = unique([
    productName
      ? `Q: What is this product? A: ${[brand, productName].filter(Boolean).join(" ")} is a ${input.formLabel.toLowerCase()} supplement.`
      : "",
    targetAudience ? `Q: Who is it for? A: ${targetAudience}.` : "",
    input.keyIngredientLine
      ? `Q: What are the main ingredients? A: ${input.keyIngredientLine}.`
      : "",
    input.suggestedUse ? `Q: How do I take it? A: ${input.suggestedUse}` : "",
    benefits ? `Q: What wellness areas does it support? A: ${benefits}.` : "",
    formCount
      ? `Q: What form and count does this product include? A: ${formCount}.`
      : "",
    input.warnings ? `Q: What should I know before use? A: ${input.warnings}` : "",
  ])
    .map((entry) => trimText(entry, 260))
    .filter((entry) => !shouldBlockGenericFaqAnswer(entry));

  return candidateSnippets.slice(0, 8);
}

export function buildAgenticReferralCopy(input: {
  facts: CanonicalProductFacts;
  product: WalmartProductRecord;
}): AgenticReferralCopyOutput {
  const facts = input.facts;
  const benefits = extractBenefitClusters(facts);
  const countLabel = normalizeCountLabel(facts.count);
  const formLabel = sanitizeCustomerFacingText(facts.form || "");
  const flavorLabel = sanitizeCustomerFacingText(facts.flavor || "");
  const audienceLabel = sanitizeCustomerFacingText(facts.targetAudience || "Adults");

  const brand = sanitizeCustomerFacingText(facts.brand || input.product.brand);
  const productName = sanitizeCustomerFacingText(
    facts.productName || facts.productType || facts.category || input.product.title
  );
  const descriptor = mergeProductNameAndForm(productName, formLabel);

  const hasIdentity = Boolean(descriptor || brand);

  const title = hasIdentity
    ? trimText(
        [
          [brand, descriptor].filter(Boolean).join(" ").trim(),
          flavorLabel ? `${flavorLabel} flavor` : "",
          countLabel,
          benefits[0] || "",
        ]
          .filter(Boolean)
          .join(", "),
        200
      )
    : "";

  const keyIngredientLine = sanitizeCustomerFacingList(facts.activeIngredients)
    .slice(0, 3)
    .join(", ");

  const suggestedUse = sanitizeCustomerFacingText(
    facts.suggestedUse || "Use only as directed on the product label."
  );

  const warnings = sanitizeCustomerFacingText(
    facts.warnings ||
      "Consult your healthcare professional before use if pregnant, nursing, taking medication, or managing a medical condition."
  );

  const benefitLine = formatBenefitLine(benefits.slice(0, 2));
  const shortDescriptionBase = [
    [brand, descriptor || "supplement"].filter(Boolean).join(" "),
    benefitLine ? `supports ${benefitLine}` : "",
    formLabel ? `in a ${formLabel.toLowerCase()} format` : "",
    facts.servingSize ? `with serving size ${facts.servingSize}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const shortDescription = hasIdentity
    ? trimText(shortDescriptionBase, 320)
    : "";

  const structuredFacts = [
    brand ? `Brand: ${brand}` : "",
    descriptor ? `Product: ${descriptor}` : "",
    facts.series ? `Series: ${facts.series}` : "",
    formLabel ? `Form: ${formLabel}` : "",
    flavorLabel ? `Flavor: ${flavorLabel}` : "",
    countLabel ? `Count: ${countLabel}` : "",
    facts.dosageStrength ? `Dosage strength: ${facts.dosageStrength}` : "",
    facts.servingSize ? `Serving size: ${facts.servingSize}` : "",
    facts.servingsPerContainer ? `Servings per container: ${facts.servingsPerContainer}` : "",
    keyIngredientLine ? `Active ingredients: ${keyIngredientLine}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const longDescription = hasIdentity
    ? ensureSingleSupplementDisclaimer(
        trimText(
          [
            [brand, descriptor || "supplement"].filter(Boolean).join(" ") +
              (benefits.length > 0
                ? ` supports ${formatBenefitLine(benefits.slice(0, 3))}.`
                : " is a supplement designed for everyday use."),
            keyIngredientLine ? `Key ingredients: ${keyIngredientLine}.` : "",
            facts.count ? `Package count: ${facts.count}.` : "",
            facts.supply ? `Supply: ${facts.supply}.` : "",
            facts.servingSize ? `Serving size: ${facts.servingSize}.` : "",
            facts.servingsPerContainer
              ? `Servings per container: ${facts.servingsPerContainer}.`
              : "",
            suggestedUse ? `Suggested use: ${suggestedUse}` : "",
            warnings ? `Safety guidance: ${warnings}` : "",
          ]
            .filter(Boolean)
            .join(" "),
          1800
        )
      )
    : "";

  const bullets = sanitizeCustomerFacingList(
    unique([
      benefits[0] ? `Designed for ${benefits[0]}` : "",
      keyIngredientLine ? `Main ingredients: ${keyIngredientLine}` : "",
      formLabel ? `${formLabel} format` : "",
      facts.dosageStrength ? `Dosage strength: ${facts.dosageStrength}` : "",
      facts.servingSize ? `Serving size: ${facts.servingSize}` : "",
      facts.count ? `Count: ${facts.count}` : "",
      facts.allergenOrDoesNotContainStatements.length
        ? `Does not contain: ${facts.allergenOrDoesNotContainStatements.slice(0, 5).join(", ")}`
        : "",
    ])
  )
    .map((entry) => trimText(entry, 180))
    .slice(0, 6);

  const searchKeywords = buildSearchKeywords({ facts, benefits });

  const aiVisibilitySummary = trimText(
    [
      [brand, descriptor || "supplement"].filter(Boolean).join(" "),
      formLabel ? `in ${formLabel.toLowerCase()} form` : "",
      keyIngredientLine ? `with ${keyIngredientLine}` : "",
      benefits.length > 0 ? `for ${formatBenefitLine(benefits.slice(0, 2))}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    500
  );

  const customerFitDescriptors = sanitizeCustomerFacingList(
    unique([
      audienceLabel || "Adults",
      formLabel ? `Customers preferring ${formLabel.toLowerCase()} supplements` : "",
      flavorLabel ? `Customers who prefer ${flavorLabel.toLowerCase()} flavor profiles` : "",
    ])
  ).slice(0, 5);

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
    title: sanitizeCustomerFacingText(title),
    shortDescription: sanitizeCustomerFacingText(shortDescription),
    longDescription: sanitizeCustomerFacingText(longDescription),
    bullets,
    searchKeywords,
    aiVisibilitySummary: sanitizeCustomerFacingText(aiVisibilitySummary),
    structuredProductFactsSummary: sanitizeCustomerFacingText(structuredFacts),
    customerFitDescriptors,
    compliantBenefitClusters: benefits,
    faqSnippets,
    disclaimer: SUPPLEMENT_FDA_DISCLAIMER,
  };
}
