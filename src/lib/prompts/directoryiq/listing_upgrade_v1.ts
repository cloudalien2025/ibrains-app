type ListingUpgradePromptInput = {
  listingName: string;
  listingUrl: string | null;
  originalDescription: string;
  allowedFacts: Record<string, unknown>;
  targets: string[];
};

function toFactLines(allowedFacts: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(allowedFacts)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      const compact = value.map((item) => String(item).trim()).filter(Boolean);
      if (compact.length > 0) lines.push(`- ${key}: ${compact.join(", ")}`);
      continue;
    }
    const text = String(value).trim();
    if (!text) continue;
    lines.push(`- ${key}: ${text}`);
  }
  return lines.length > 0 ? lines.join("\n") : "- none";
}

function toTargetLines(targets: string[]): string {
  if (targets.length === 0) return "- Improve specificity, trust, and CTA clarity.";
  return targets.map((item) => `- ${item}`).join("\n");
}

export function buildListingUpgradePromptV1(input: ListingUpgradePromptInput): string {
  return [
    "You are DirectoryIQ's listing upgrade writer.",
    "Write one improved listing description for this business.",
    "",
    "Strict rules:",
    "- Do not invent facts, achievements, stats, awards, ratings, or credentials.",
    "- Use only Allowed Facts below.",
    "- If required detail is missing, add one concise sentence requesting that detail from the business.",
    "- Keep tone confident, concise, premium, and helpful.",
    "- Output description text only. No analysis. No bullets unless the current format already uses bullets.",
    "- Keep the description practical and conversion-oriented with a clear next step.",
    "",
    `Listing Name: ${input.listingName}`,
    `Listing URL: ${input.listingUrl ?? "Not provided"}`,
    "",
    "Current Description:",
    input.originalDescription || "(empty)",
    "",
    "Allowed Facts:",
    toFactLines(input.allowedFacts),
    "",
    "Targets:",
    toTargetLines(input.targets),
    "",
    "Now return only the upgraded listing description.",
  ].join("\n");
}

export function outputHasBlockedPlaceholders(text: string): boolean {
  const blockedPatterns = [/\[insert/i, /\[.*tbd.*\]/i, /\btbd\b/i, /\bplaceholder\b/i];
  return blockedPatterns.some((pattern) => pattern.test(text));
}
