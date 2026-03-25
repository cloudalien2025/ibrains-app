import type { FaqPublishGateResult, FaqValidationResult, ListingFaqContext } from "@/lib/directoryiq/faq/types";

export function applyFaqPublishGate(input: {
  context: ListingFaqContext;
  validation: FaqValidationResult;
  finalFaqEntryCount: number;
}): FaqPublishGateResult {
  const reasons = [...input.validation.blockedReasons];

  if (input.context.known_facts.length < 4 || (input.validation.metrics?.distinct_grounded_facts ?? 0) < 3) {
    reasons.push("not enough grounded facts");
  }
  if (input.context.unknown_facts.length > input.context.known_facts.length + 2) reasons.push("too many unknown facts");
  if (input.finalFaqEntryCount < 4) reasons.push("not enough grounded FAQ entries");
  if (input.validation.quality.generic_language_penalty > 25) reasons.push("generic-language penalty too high");
  if ((input.validation.metrics?.fallback_ratio ?? 0) > 0.5) reasons.push("fallback ratio too high for publish");
  if ((input.validation.metrics?.distinct_grounded_facts ?? 0) < 3) reasons.push("not enough distinct grounded facts for publish");
  if ((input.validation.metrics?.repeated_source_fact_ratio ?? 0) > 0.45) reasons.push("repeated source facts make FAQ too thin");
  if ((input.validation.metrics?.repeated_first_sentence_ratio ?? 0) > 0.45) reasons.push("FAQ answers feel overly templated");
  if ((input.validation.metrics?.unsupported_question_count ?? 0) > 0) reasons.push("one or more FAQ answers are not credibly supported");

  return {
    allowPublish: reasons.length === 0,
    reasons,
  };
}
