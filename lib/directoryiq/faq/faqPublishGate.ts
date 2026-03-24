import type { FaqPublishGateResult, FaqValidationResult, ListingFaqContext } from "@/lib/directoryiq/faq/types";

export function applyFaqPublishGate(input: {
  context: ListingFaqContext;
  validation: FaqValidationResult;
  finalFaqEntryCount: number;
}): FaqPublishGateResult {
  const reasons = [...input.validation.blockedReasons];

  if (input.context.known_facts.length < 3) reasons.push("not enough grounded facts");
  if (input.context.unknown_facts.length > input.context.known_facts.length + 2) reasons.push("too many unknown facts");
  if (input.finalFaqEntryCount < 4) reasons.push("not enough grounded FAQ entries");
  if (input.validation.quality.generic_language_penalty > 35) reasons.push("generic-language penalty too high");

  return {
    allowPublish: reasons.length === 0,
    reasons,
  };
}
