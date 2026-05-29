import type {
  ShopifyPdpComplianceReview,
  ShopifyPdpFaqEntry,
  ShopifyPdpIntelligenceRecord,
} from "@/lib/ecomviper/shopify/shopify-pdp-intelligence";

const BLOCKED_PHRASES = [
  "ed",
  "erectile dysfunction",
  "high blood pressure",
  "hypertension",
  "heart disease",
  "anxiety",
  "insomnia",
  "depression",
  "cure",
  "treat",
  "prevent",
  "reverse",
  "clinically proven to treat",
  "natural viagra",
  "works like cialis",
  "drug-comparison",
];

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function collectPdpText(record: ShopifyPdpIntelligenceRecord): string[] {
  const faqLines = record.faqs.flatMap((entry) => [entry.question, entry.answer, entry.category]);
  return [
    record.ai_product_summary,
    ...record.best_for,
    ...record.not_best_for,
    ...record.use_cases,
    ...record.ingredient_highlights,
    ...record.trust_signals,
    ...record.certifications,
    ...record.compliance_safe_claims,
    record.comparison_content,
    record.agentic_selection_notes,
    ...faqLines,
    ...record.compliance_notes,
  ].map((entry) => normalizeText(entry));
}

function containsPhrase(input: string, phrase: string): boolean {
  const normalizedPhrase = phrase.toLowerCase();
  if (normalizedPhrase.length <= 3) {
    return input.toLowerCase().split(/[^a-z0-9]+/g).includes(normalizedPhrase);
  }
  return input.toLowerCase().includes(normalizedPhrase);
}

export function evaluateShopifyPdpCompliance(record: ShopifyPdpIntelligenceRecord): ShopifyPdpComplianceReview {
  const textCorpus = collectPdpText(record).filter(Boolean);
  const risky = new Set<string>();

  for (const phrase of BLOCKED_PHRASES) {
    if (textCorpus.some((entry) => containsPhrase(entry, phrase))) {
      risky.add(phrase);
    }
  }

  const riskyPhrases = Array.from(risky.values());
  const riskLevel =
    riskyPhrases.length >= 3 ? "high" : riskyPhrases.length >= 1 ? "medium" : "low";

  const saferRewriteNotes = riskyPhrases.map(
    (phrase) =>
      `Replace "${phrase}" with compliant structure/function language such as "supports daily wellness".`
  );

  const supplementNotes = [
    "Keep claims fact-grounded to Shopify listing and supplier intelligence inputs.",
    "Avoid disease, treatment, cure, prevention, or drug-comparison language in shopper-facing PDP copy.",
  ];

  return {
    risk_level: riskLevel,
    risky_phrases_found: riskyPhrases,
    safer_rewrite_notes: saferRewriteNotes,
    supplement_compliance_notes: supplementNotes,
  };
}

export function sanitizeShopifyPdpFaqs(
  faqs: ShopifyPdpFaqEntry[],
  riskyPhrases: string[]
): ShopifyPdpFaqEntry[] {
  if (!riskyPhrases.length) return faqs;

  return faqs.map((faq) => {
    const flagged = riskyPhrases.some(
      (phrase) =>
        containsPhrase(faq.question, phrase) || containsPhrase(faq.answer, phrase)
    );
    if (!flagged) return faq;
    return {
      ...faq,
      schema_eligible: false,
      compliance_status: "review_required",
    };
  });
}
