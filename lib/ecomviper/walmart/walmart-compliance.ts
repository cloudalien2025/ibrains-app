const PROMOTIONAL_PHRASES = [
  "best seller",
  "bestseller",
  "limited time",
  "free shipping",
  "money back guarantee",
  "100% guaranteed",
  "guaranteed results",
  "buy one get one",
];

const HARD_BLOCK_PHRASES = [
  "natural viagra",
  "works like cialis",
  "works like viagra",
  "prescription strength",
];

const MEDICAL_CONDITION_PATTERNS = [
  /\berectile dysfunction\b/i,
  /\bed\b/i,
  /\bhypertension\b/i,
  /\banxiety\b/i,
  /\binsomnia\b/i,
  /\bdepression\b/i,
  /\bdiabetes\b/i,
  /\barthritis\b/i,
];

const CLAIM_VERB_PATTERNS = [/\bcure(s|d)?\b/i, /\btreat(s|ed|ment)?\b/i, /\bprevent(s|ed|ion)?\b/i, /\breverse(s|d)?\b/i, /\bdiagnos(e|es|ed|is)\b/i];

const URL_PATTERN = /\bhttps?:\/\/|www\./i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/;

export interface WalmartComplianceResult {
  valid: boolean;
  violations: string[];
  warnings: string[];
  suggestions: string[];
}

function unique(list: string[]): string[] {
  return Array.from(new Set(list));
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asBulletPoints(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return [];
}

function hasMedicalClaim(text: string): boolean {
  const normalized = text.toLowerCase();
  const hasCondition = MEDICAL_CONDITION_PATTERNS.some((pattern) => pattern.test(normalized));
  const hasClaimVerb = CLAIM_VERB_PATTERNS.some((pattern) => pattern.test(normalized));
  return hasCondition && hasClaimVerb;
}

function hasForbiddenContact(text: string): boolean {
  return URL_PATTERN.test(text) || EMAIL_PATTERN.test(text) || PHONE_PATTERN.test(text);
}

function hasPromoPhrase(text: string): boolean {
  const normalized = text.toLowerCase();
  return PROMOTIONAL_PHRASES.some((phrase) => normalized.includes(phrase));
}

function hasHardBlockPhrase(text: string): boolean {
  const normalized = text.toLowerCase();
  return HARD_BLOCK_PHRASES.some((phrase) => normalized.includes(phrase));
}

function hasLikelyTagMarkup(text: string): boolean {
  return /<[^>]+>/.test(text);
}

export function evaluateWalmartListingCompliance(payload: Record<string, unknown>): WalmartComplianceResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  const title = asText(payload.title);
  const shortDescription = asText(payload.shortDescription);
  const longDescription = asText(payload.longDescription);
  const bullets = asBulletPoints(payload.bulletPoints);

  if (title) {
    if (title.length > 200) {
      violations.push("Title exceeds 200 characters.");
      suggestions.push("Keep titles concise and under 200 characters.");
    } else if (title.length < 20) {
      warnings.push("Title may be too short for Walmart search relevance.");
    }

    if (hasPromoPhrase(title)) {
      violations.push("Remove promotional wording from title (for example, free shipping or limited time claims).");
      suggestions.push("Use factual product attributes instead of promotional messaging in title.");
    }

    if (hasForbiddenContact(title)) {
      violations.push("Title cannot include URLs, phone numbers, or email addresses.");
      suggestions.push("Remove external links and contact details from title.");
    }

    if (hasLikelyTagMarkup(title)) {
      violations.push("Title cannot include HTML or tag markup.");
    }

    const alphaChars = title.replace(/[^a-z]/gi, "");
    if (alphaChars.length >= 12 && alphaChars === alphaChars.toUpperCase()) {
      warnings.push("Avoid all-caps title formatting.");
    }
  }

  if ("bulletPoints" in payload) {
    if (bullets.length === 0) {
      violations.push("Bullet points cannot be empty when bulletPoints is provided.");
    }

    if (bullets.length > 10) {
      violations.push("Provide no more than 10 bullet points.");
      suggestions.push("Keep bullet points to 3-10 concise key features.");
    } else if (bullets.length > 0 && bullets.length < 3) {
      warnings.push("Consider at least 3 bullet points for stronger listing quality.");
    }
  }

  if (longDescription.length > 4000) {
    warnings.push("Long description exceeds 4000 characters and may be truncated.");
  }

  for (const [field, value] of [
    ["title", title],
    ["shortDescription", shortDescription],
    ["longDescription", longDescription],
    ...bullets.map((bullet, index) => [`bulletPoints[${index}]`, bullet] as const),
  ] as const) {
    if (!value) continue;

    if (hasMedicalClaim(value) || hasHardBlockPhrase(value)) {
      violations.push(`Potential medical/drug claim detected in ${field}.`);
      suggestions.push("Use supportive wellness wording and avoid disease treatment, cure, or drug comparisons.");
    }

    if (hasForbiddenContact(value)) {
      violations.push(`Remove URL/contact details from ${field}.`);
      suggestions.push("Keep listing copy self-contained without external contact details.");
    }

    if (hasLikelyTagMarkup(value)) {
      violations.push(`Remove HTML/tag markup from ${field}.`);
    }

    if (field.startsWith("bulletPoints[") && value.length > 200) {
      warnings.push(`${field} is long; consider keeping bullets under 200 characters.`);
    }

    if (hasPromoPhrase(value) && field !== "title") {
      warnings.push(`Promotional language detected in ${field}.`);
      suggestions.push("Prefer objective product details over urgency or promotional claims.");
    }
  }

  const additionalImageUrls = payload.additionalImageUrls;
  if (Array.isArray(additionalImageUrls)) {
    for (const [index, entry] of additionalImageUrls.entries()) {
      if (typeof entry !== "string") continue;
      const trimmed = entry.trim();
      if (!trimmed) continue;
      if (!/^https?:\/\//i.test(trimmed)) {
        warnings.push(`additionalImageUrls[${index}] should use an http/https URL.`);
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations: unique(violations),
    warnings: unique(warnings),
    suggestions: unique(suggestions),
  };
}
