export type WalmartFlavorConfidence = "explicit" | "default_unflavored" | "unknown";

export interface WalmartFlavorCandidate {
  value: unknown;
  source: string;
}

export interface WalmartFlavorResolution {
  flavor: string;
  source: string;
  confidence: WalmartFlavorConfidence;
}

export interface WalmartFlavorResolutionInput {
  candidates?: WalmartFlavorCandidate[];
  labelTextCandidates?: WalmartFlavorCandidate[];
  defaultWhenMissing?: boolean;
}

const KNOWN_FLAVOR_TERMS = [
  "mixed berry",
  "berry",
  "strawberry",
  "cherry",
  "vanilla",
  "citrus",
  "orange",
  "grape",
  "lemon",
  "watermelon",
  "apple",
  "raspberry",
  "peach",
  "mint",
];

const KNOWN_FLAVOR_PATTERN = KNOWN_FLAVOR_TERMS.map((entry) => entry.replace(/\s+/g, "\\s+")).join("|");

const FLAVOR_CLAIM_PATTERNS = [
  new RegExp(`\\b(${KNOWN_FLAVOR_PATTERN})\\s+flavou?r(?:ed)?\\b`, "gi"),
  new RegExp(`\\bflavou?red\\s+(${KNOWN_FLAVOR_PATTERN})\\b`, "gi"),
  /\bunflavo(?:r|u)ed\s+flavou?r\b/gi,
  new RegExp(
    `(?:^|,\\s*)(${KNOWN_FLAVOR_PATTERN})(?=\\s*(?:,|$|\\d+\\s*(?:capsules?|tablets?|softgels?|gummies?|count|ct)\\b))`,
    "gi"
  ),
];

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => {
      if (!part) return "";
      if (part.length === 1) return part.toUpperCase();
      return `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`;
    })
    .join(" ")
    .trim();
}

function normalizeFlavorToken(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeExplicitFlavorCandidate(value: string): string | null {
  const normalized = normalizeFlavorToken(value)
    .replace(/\bflavou?r(?:ed)?\b/gi, "")
    .trim();
  if (!normalized) return null;
  if (/\b(goji|wolfberry)\b/i.test(normalized)) return null;
  if (normalized.length > 40) return null;
  if (normalized.includes(",")) return null;
  if (/[^a-z0-9\s\-]/i.test(normalized)) return null;
  if (/^(no\s+flavou?r|flavou?rless|non[-\s]?flavou?red|unflavo(?:r|u)ed)$/i.test(normalized)) {
    return "Unflavored";
  }
  return toTitleCase(normalized);
}

export function extractExplicitWalmartFlavorFromText(value: string): string | null {
  const text = asText(value);
  if (!text) return null;

  const naturalFlavorMatch = text.match(/natural\s+flavou?r\s*\(([^)]+)\)/i);
  if (naturalFlavorMatch?.[1]) {
    return normalizeExplicitFlavorCandidate(naturalFlavorMatch[1]);
  }

  const flavorLabelMatch = text.match(/(?:^|[\s,;|])flavou?r\s*[:\-]\s*([a-z][a-z0-9\s-]{1,40})/i);
  if (flavorLabelMatch?.[1]) {
    return normalizeExplicitFlavorCandidate(flavorLabelMatch[1]);
  }

  const flavoredMatch = text.match(/\b([a-z][a-z0-9\s-]{1,30})\s+flavou?r(?:ed)?\b/i);
  if (flavoredMatch?.[1]) {
    return normalizeExplicitFlavorCandidate(flavoredMatch[1]);
  }

  return null;
}

export function normalizeWalmartFlavor(input: unknown): string | null {
  const raw = asText(input);
  if (!raw) return null;

  const loweredRaw = raw.toLowerCase();
  if (/^(unknown|n\/a|na|none|null|undefined|not provided|not available|unsure)$/i.test(loweredRaw)) {
    return null;
  }
  if (/^(e\.?g\.?|example)\b/i.test(loweredRaw)) return null;

  const extracted = extractExplicitWalmartFlavorFromText(raw);
  if (extracted) return extracted;

  const normalized = normalizeFlavorToken(raw)
    .replace(/^flavou?r\s*[:\-]\s*/i, "")
    .replace(/\bflavou?r(?:ed)?\b/gi, "")
    .trim();

  if (!normalized) return null;
  if (/\b(goji|wolfberry)\b/i.test(normalized)) return null;
  if (/^(no\s+flavou?r|flavou?rless|non[-\s]?flavou?red|unflavo(?:r|u)ed)$/i.test(normalized)) {
    return "Unflavored";
  }
  return normalizeExplicitFlavorCandidate(normalized);
}

export function detectWalmartFlavorClaims(value: string): string[] {
  const text = asText(value);
  if (!text) return [];

  const matches: string[] = [];
  for (const pattern of FLAVOR_CLAIM_PATTERNS) {
    const clone = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = clone.exec(text)) !== null) {
      const claim = normalizeFlavorToken(match[0]);
      if (!claim) continue;
      matches.push(claim);
    }
  }
  return Array.from(new Set(matches));
}

export function resolveWalmartFlavorFromFacts(
  input: WalmartFlavorResolutionInput
): WalmartFlavorResolution {
  const candidates = input.candidates ?? [];
  for (const candidate of candidates) {
    const normalized = normalizeWalmartFlavor(candidate.value);
    if (!normalized) continue;
    return {
      flavor: normalized,
      source: candidate.source || "trusted_candidate",
      confidence: "explicit",
    };
  }

  const labelTextCandidates = input.labelTextCandidates ?? [];
  for (const candidate of labelTextCandidates) {
    const extracted = extractExplicitWalmartFlavorFromText(asText(candidate.value));
    if (!extracted) continue;
    return {
      flavor: extracted,
      source: candidate.source || "label_text",
      confidence: "explicit",
    };
  }

  if (input.defaultWhenMissing === false) {
    return {
      flavor: "",
      source: "unknown",
      confidence: "unknown",
    };
  }

  return {
    flavor: "Unflavored",
    source: "default_unflavored",
    confidence: "default_unflavored",
  };
}
