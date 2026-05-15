import {
  detectRiskyClaims,
  sanitizeRiskyClaims,
} from "@/lib/ecomviper/walmart/walmart-ai-visibility-content-policy";
import {
  containsRepeatedSupportArtifact,
  countCanonicalSupplementDisclaimer,
  normalizeSupplementDisclaimerText,
  removeSupplementDisclaimerVariants,
  type SupplementDisclaimerStatus,
} from "@/lib/ecomviper/walmart/walmart-supplement-disclaimer";
import {
  sanitizeCustomerFacingText,
  shouldBlockGenericFaqAnswer,
} from "@/lib/ecomviper/walmart/walmart-truth-guard";

export type WalmartComplianceDecision = "accepted" | "accepted_with_changes" | "rejected";
export type WalmartDisclaimerStatus = SupplementDisclaimerStatus;

export interface WalmartComplianceContent {
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
}

export interface WalmartComplianceAgentResult {
  compliantContent: WalmartComplianceContent;
  changedFields: string[];
  rejectedClaims: string[];
  disclaimerStatus: WalmartDisclaimerStatus;
  repetitionWarnings: string[];
  finalDecision: WalmartComplianceDecision;
  rejectionReasons: string[];
}

const FORBIDDEN_PHRASES_OUTSIDE_DISCLAIMER = [
  /\bed\b/i,
  /\berectile\s+dysfunction\b/i,
  /\bhypertension\b/i,
  /\banxiety\b/i,
  /\binsomnia\b/i,
  /\bdepression\b/i,
  /\bnatural\s+viagra\b/i,
  /\bworks\s+like\s+cialis\b/i,
  /\bguaranteed\s+results?\b/i,
  /\bclinically\s+proven\b/i,
  /\bbest\s+(?:in|for)\b/i,
];

const REPEATED_FILLER_PATTERNS = [
  /(supports\s+wellness)(?:[\s,;:-]+\1){1,}/gi,
  /(daily\s+wellness\s+support)(?:[\s,;:-]+\1){1,}/gi,
  /(support\s+language)(?:[\s,;:-]+\1){1,}/gi,
];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s{2,}/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
}

function sanitizeFiller(value: string): { sanitized: string; warnings: string[] } {
  let working = normalizeWhitespace(value);
  const warnings: string[] = [];

  for (const pattern of REPEATED_FILLER_PATTERNS) {
    if (!pattern.test(working)) continue;
    warnings.push(`Repetitive filler removed: ${pattern.source}`);
    working = working.replace(pattern, (_match, group) => String(group));
  }

  working = working.replace(/\b(\w+)(?:\s+\1){2,}\b/gi, "$1");
  return {
    sanitized: normalizeWhitespace(working),
    warnings: unique(warnings),
  };
}

function collectForbiddenClaimsOutsideDisclaimer(value: string): string[] {
  const outsideDisclaimer = removeSupplementDisclaimerVariants(value);
  const hits: string[] = [];

  for (const pattern of FORBIDDEN_PHRASES_OUTSIDE_DISCLAIMER) {
    if (pattern.test(outsideDisclaimer)) hits.push(pattern.source);
  }

  for (const pattern of detectRiskyClaims(outsideDisclaimer)) {
    hits.push(pattern);
  }

  return unique(hits);
}

function sanitizeTextField(value: string): {
  value: string;
  rejectedClaims: string[];
  repetitionWarnings: string[];
} {
  const riskySanitized = sanitizeRiskyClaims(value);
  const fillerSanitized = sanitizeFiller(riskySanitized.sanitized);
  const customerFacingSafe = sanitizeCustomerFacingText(fillerSanitized.sanitized);

  return {
    value: customerFacingSafe,
    rejectedClaims: riskySanitized.rejectedRiskyClaims,
    repetitionWarnings: fillerSanitized.warnings,
  };
}

function sanitizeKeywordList(values: string[]): {
  keywords: string[];
  rejectedClaims: string[];
} {
  const keywords: string[] = [];
  const rejected: string[] = [];

  for (const entry of values) {
    const text = normalizeWhitespace(entry);
    if (!text) continue;
    const findings = collectForbiddenClaimsOutsideDisclaimer(text);
    if (findings.length > 0) {
      rejected.push(...findings);
      continue;
    }
    keywords.push(text);
  }

  return {
    keywords: unique(keywords).slice(0, 16),
    rejectedClaims: unique(rejected),
  };
}

function sanitizeList(values: string[]): {
  values: string[];
  rejectedClaims: string[];
  repetitionWarnings: string[];
} {
  const output: string[] = [];
  const rejectedClaims: string[] = [];
  const repetitionWarnings: string[] = [];

  for (const entry of values) {
    const sanitized = sanitizeTextField(entry);
    if (!sanitized.value) continue;
    output.push(sanitized.value);
    rejectedClaims.push(...sanitized.rejectedClaims);
    repetitionWarnings.push(...sanitized.repetitionWarnings);
  }

  return {
    values: unique(output),
    rejectedClaims: unique(rejectedClaims),
    repetitionWarnings: unique(repetitionWarnings),
  };
}

function copyChangedFields(input: {
  before: WalmartComplianceContent;
  after: WalmartComplianceContent;
}): string[] {
  const changed: string[] = [];

  const compare = (key: keyof WalmartComplianceContent, label: string) => {
    const before = input.before[key];
    const after = input.after[key];

    if (Array.isArray(before) && Array.isArray(after)) {
      if (JSON.stringify(before) !== JSON.stringify(after)) changed.push(label);
      return;
    }

    if (String(before ?? "") !== String(after ?? "")) changed.push(label);
  };

  compare("title", "title");
  compare("shortDescription", "shortDescription");
  compare("longDescription", "longDescription");
  compare("bullets", "bullets");
  compare("searchKeywords", "searchKeywords");
  compare("aiVisibilitySummary", "aiVisibilitySummary");
  compare("structuredProductFactsSummary", "structuredProductFactsSummary");
  compare("customerFitDescriptors", "customerFitDescriptors");
  compare("compliantBenefitClusters", "compliantBenefitClusters");
  compare("faqSnippets", "faqSnippets");

  return changed;
}

export function reviewWalmartSupplementCopy(
  input: WalmartComplianceContent
): WalmartComplianceAgentResult {
  const base: WalmartComplianceContent = {
    title: asString(input.title),
    shortDescription: asString(input.shortDescription),
    longDescription: asString(input.longDescription),
    bullets: unique(input.bullets ?? []),
    searchKeywords: unique(input.searchKeywords ?? []),
    aiVisibilitySummary: asString(input.aiVisibilitySummary),
    structuredProductFactsSummary: asString(input.structuredProductFactsSummary),
    customerFitDescriptors: unique(input.customerFitDescriptors ?? []),
    compliantBenefitClusters: unique(input.compliantBenefitClusters ?? []),
    faqSnippets: unique(input.faqSnippets ?? []),
  };

  const title = sanitizeTextField(base.title);
  const shortDescription = sanitizeTextField(base.shortDescription);
  const longDescriptionSanitized = sanitizeTextField(base.longDescription);
  const disclaimerNormalization = normalizeSupplementDisclaimerText(
    longDescriptionSanitized.value,
    { appendWhenMissing: true }
  );
  const longDescriptionWithDisclaimer = disclaimerNormalization.normalizedText;
  const bullets = sanitizeList(base.bullets);
  const searchKeywords = sanitizeKeywordList(base.searchKeywords);
  const aiVisibilitySummary = sanitizeTextField(base.aiVisibilitySummary);
  const structuredFacts = sanitizeTextField(base.structuredProductFactsSummary);
  const customerFit = sanitizeList(base.customerFitDescriptors);
  const benefitClusters = sanitizeList(base.compliantBenefitClusters);
  const faqSnippets = sanitizeList(base.faqSnippets);

  const disclaimerStatus: WalmartDisclaimerStatus = disclaimerNormalization.status;

  const compliantContent: WalmartComplianceContent = {
    title: title.value,
    shortDescription: shortDescription.value,
    longDescription: longDescriptionWithDisclaimer,
    bullets: bullets.values.slice(0, 8),
    searchKeywords: searchKeywords.keywords,
    aiVisibilitySummary: aiVisibilitySummary.value,
    structuredProductFactsSummary: structuredFacts.value,
    customerFitDescriptors: customerFit.values.slice(0, 8),
    compliantBenefitClusters: benefitClusters.values.slice(0, 8),
    faqSnippets: faqSnippets.values.filter((entry) => !shouldBlockGenericFaqAnswer(entry)).slice(0, 8),
  };

  const rejectedClaims = unique([
    ...title.rejectedClaims,
    ...shortDescription.rejectedClaims,
    ...longDescriptionSanitized.rejectedClaims,
    ...bullets.rejectedClaims,
    ...searchKeywords.rejectedClaims,
    ...aiVisibilitySummary.rejectedClaims,
    ...structuredFacts.rejectedClaims,
    ...customerFit.rejectedClaims,
    ...benefitClusters.rejectedClaims,
    ...faqSnippets.rejectedClaims,
    ...collectForbiddenClaimsOutsideDisclaimer(compliantContent.title),
    ...collectForbiddenClaimsOutsideDisclaimer(compliantContent.shortDescription),
    ...collectForbiddenClaimsOutsideDisclaimer(compliantContent.longDescription),
    ...collectForbiddenClaimsOutsideDisclaimer(compliantContent.bullets.join(" ")),
    ...collectForbiddenClaimsOutsideDisclaimer(compliantContent.aiVisibilitySummary),
  ]);

  const unresolvedRiskyClaims = unique([
    ...collectForbiddenClaimsOutsideDisclaimer(compliantContent.title),
    ...collectForbiddenClaimsOutsideDisclaimer(compliantContent.shortDescription),
    ...collectForbiddenClaimsOutsideDisclaimer(compliantContent.longDescription),
    ...collectForbiddenClaimsOutsideDisclaimer(compliantContent.bullets.join(" ")),
    ...collectForbiddenClaimsOutsideDisclaimer(compliantContent.aiVisibilitySummary),
  ]);

  const repetitionWarnings = unique([
    ...title.repetitionWarnings,
    ...shortDescription.repetitionWarnings,
    ...longDescriptionSanitized.repetitionWarnings,
    ...bullets.repetitionWarnings,
    ...aiVisibilitySummary.repetitionWarnings,
    ...structuredFacts.repetitionWarnings,
    ...customerFit.repetitionWarnings,
    ...benefitClusters.repetitionWarnings,
    ...faqSnippets.repetitionWarnings,
    ...(containsRepeatedSupportArtifact(compliantContent.longDescription)
      ? ["Repeated support phrase artifacts detected in long description."]
      : []),
  ]);

  const rejectionReasons: string[] = [];
  if (!compliantContent.title) rejectionReasons.push("title_empty_after_compliance");
  if (!compliantContent.longDescription) rejectionReasons.push("long_description_empty_after_compliance");
  if (countCanonicalSupplementDisclaimer(compliantContent.longDescription) !== 1) {
    rejectionReasons.push("fda_disclaimer_not_exactly_once");
  }
  if (disclaimerNormalization.malformedFragments.length > 0) {
    rejectionReasons.push("malformed_fda_disclaimer_detected");
  }
  if (unresolvedRiskyClaims.length > 0) {
    rejectionReasons.push("risky_claims_detected_after_compliance");
  }

  const changedFields = copyChangedFields({
    before: base,
    after: compliantContent,
  });

  const finalDecision: WalmartComplianceDecision =
    rejectionReasons.length > 0
      ? "rejected"
      : changedFields.length > 0 || repetitionWarnings.length > 0 || rejectedClaims.length > 0
      ? "accepted_with_changes"
      : "accepted";

  return {
    compliantContent,
    changedFields,
    rejectedClaims,
    disclaimerStatus,
    repetitionWarnings,
    finalDecision,
    rejectionReasons: unique(rejectionReasons),
  };
}
