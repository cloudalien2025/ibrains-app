export type ListingUpgradePromptInput = {
  listingName: string;
  listingUrl: string | null;
  originalDescription: string;
  allowedFacts: Record<string, unknown>;
  targets: string[];
};

function formatAllowedFacts(allowedFacts: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(allowedFacts)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      const normalized = value.map((item) => String(item).trim()).filter(Boolean);
      if (normalized.length > 0) lines.push(`- ${key}: ${normalized.join(", ")}`);
      continue;
    }
    const normalized = String(value).trim();
    if (normalized) lines.push(`- ${key}: ${normalized}`);
  }
  return lines.length > 0 ? lines.join("\n") : "- none";
}

function formatTargets(targets: string[]): string {
  if (targets.length === 0) return "- Improve clarity, trust cues, and CTA quality.";
  return targets.map((target) => `- ${target}`).join("\n");
}

export function buildListingUpgradePromptV1(input: ListingUpgradePromptInput): string {
  return [
    "You are DirectoryIQ's listing optimization writer.",
    "Produce exactly one upgraded listing description.",
    "",
    "Non-negotiable rules:",
    "- Use only Allowed Facts. No hallucinations.",
    "- Do not invent stats, awards, certifications, reviews, or guarantees.",
    "- If key information is missing, write neutral text and ask for that detail in one short sentence.",
    "- Output plain listing description only.",
    "- No placeholders such as [INSERT], TBD, TODO.",
    "",
    `Listing Name: ${input.listingName}`,
    `Listing URL: ${input.listingUrl ?? "Not provided"}`,
    "",
    "Current Description:",
    input.originalDescription || "(empty)",
    "",
    "Allowed Facts:",
    formatAllowedFacts(input.allowedFacts),
    "",
    "Targets:",
    formatTargets(input.targets),
  ].join("\n");
}
