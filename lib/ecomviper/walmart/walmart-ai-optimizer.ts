import "server-only";

import type { WalmartAiSuggestion, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

const forbiddenTerms = [
  "ed",
  "erectile dysfunction",
  "hypertension",
  "anxiety",
  "insomnia",
  "depression",
  "cure",
  "treat",
  "prevent",
  "reverse",
  "natural viagra",
  "works like cialis",
];

function makeSafeTitle(product: WalmartProductRecord) {
  const titleBase = product.title.replace(/\s+/g, " ").trim();
  return `${titleBase} | Daily Wellness Support`;
}

function makeSafeDescription(product: WalmartProductRecord) {
  return [
    `${product.brand} ${product.sku} is crafted for premium daily wellness routines with a clean supplement positioning.`,
    "The formula is written for Google Shopping-safe language and emphasizes relaxation support, circulation support, endurance support, and overall performance support without disease claims.",
    "Supports consistent wellness habits with transparent serving guidance and quality-focused manufacturing standards.",
    "*These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
  ].join(" ");
}

function safeBullets(product: WalmartProductRecord) {
  return [
    `${product.brand} premium supplement profile for daily wellness support`,
    "Supports relaxation support, circulation support, and endurance support routines",
    "Built for men’s wellness and women’s wellness lifestyle goals",
    "Focuses on heart wellness, joint comfort, and mobility support language",
    "Google Shopping-safe structure with compliant benefit framing",
  ];
}

export function buildDeterministicAiSuggestion(product: WalmartProductRecord): WalmartAiSuggestion {
  const qualityScore = Math.max(52, 88 - product.issues.length * 8 - (product.imageUrl ? 0 : 8));

  const warnings = [
    ...product.issues,
    ...forbiddenTerms.map((term) => `Avoid term: ${term}`),
  ].slice(0, 6);

  const missingAttributes = Object.keys(product.attributes).length
    ? []
    : ["serving_size", "form", "ingredients_highlights", "lifestyle_fit"];

  return {
    sku: product.sku,
    qualityScore,
    suggestedTitle: makeSafeTitle(product),
    suggestedDescription: makeSafeDescription(product),
    suggestedBullets: safeBullets(product),
    missingAttributes,
    complianceWarnings: warnings,
    disclaimer:
      "*These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
  };
}
