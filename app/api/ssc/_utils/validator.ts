import type { ScorePayload } from "./types";

export type ValidationFailure = {
  error_code: "SSC_VALIDATION_FAILED";
  rule_failed: string;
  details?: string;
};

export class SscValidationError extends Error {
  failure: ValidationFailure;

  constructor(ruleFailed: string, details?: string) {
    super(`SSC validation failed: ${ruleFailed}`);
    this.failure = {
      error_code: "SSC_VALIDATION_FAILED",
      rule_failed: ruleFailed,
      details,
    };
  }
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function ensureKeysExact(obj: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(obj).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length) {
    throw new SscValidationError("keys_exact", `Expected keys ${expected}`);
  }
  for (let i = 0; i < expected.length; i += 1) {
    if (actual[i] !== expected[i]) {
      throw new SscValidationError("keys_exact", `Expected keys ${expected}`);
    }
  }
}

export function validateSscResponse(
  payloadText: string,
  opts: {
    dimension: string;
    sourceText: string;
    flagsVocabulary: string[];
  }
): ScorePayload {
  const trimmed = payloadText.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    throw new SscValidationError("json_only", "Response is not a JSON object");
  }

  let parsed: ScorePayload;
  try {
    parsed = JSON.parse(trimmed) as ScorePayload;
  } catch {
    throw new SscValidationError("json_only", "Response could not be parsed");
  }

  ensureKeysExact(parsed as unknown as Record<string, unknown>, [
    "dimension",
    "score",
    "reasons",
    "flags",
  ]);

  if (parsed.dimension !== opts.dimension) {
    throw new SscValidationError(
      "dimension_lock",
      `Expected ${opts.dimension} got ${parsed.dimension}`
    );
  }

  if (!Number.isInteger(parsed.score)) {
    throw new SscValidationError("score_integer", "Score must be integer");
  }
  if (parsed.score < 0 || parsed.score > 20) {
    throw new SscValidationError("score_range", "Score out of range 0-20");
  }

  if (!Array.isArray(parsed.reasons) || parsed.reasons.length !== 3) {
    throw new SscValidationError("reasons_count", "Exactly 3 reasons required");
  }

  parsed.reasons.forEach((reason, index) => {
    ensureKeysExact(reason as unknown as Record<string, unknown>, [
      "title",
      "explanation",
      "quote",
    ]);

    if (typeof reason.title !== "string") {
      throw new SscValidationError("reason_title", `Reason ${index} title invalid`);
    }
    if (typeof reason.explanation !== "string") {
      throw new SscValidationError(
        "reason_explanation",
        `Reason ${index} explanation invalid`
      );
    }
    if (wordCount(reason.explanation) > 60) {
      throw new SscValidationError(
        "explanation_word_limit",
        `Reason ${index} explanation too long`
      );
    }

    if (reason.quote !== null && typeof reason.quote !== "string") {
      throw new SscValidationError("quote_type", `Reason ${index} quote invalid`);
    }
    if (typeof reason.quote === "string") {
      if (wordCount(reason.quote) > 25) {
        throw new SscValidationError("quote_word_limit", `Reason ${index} quote too long`);
      }
      if (reason.quote && !opts.sourceText.includes(reason.quote)) {
        throw new SscValidationError(
          "quote_not_substring",
          `Reason ${index} quote not in source text`
        );
      }
    }
  });

  if (!Array.isArray(parsed.flags)) {
    throw new SscValidationError("flags_type", "Flags must be array");
  }
  for (const flag of parsed.flags) {
    if (typeof flag !== "string") {
      throw new SscValidationError("flags_type", "Flags must be strings");
    }
    if (!opts.flagsVocabulary.includes(flag)) {
      throw new SscValidationError("flags_vocab", `Flag not allowed: ${flag}`);
    }
  }

  return parsed;
}
