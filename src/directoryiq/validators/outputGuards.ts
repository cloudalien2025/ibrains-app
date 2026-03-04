const BLOCKED_PATTERNS = [/\[insert/i, /\bTBD\b/i, /\bTODO\b/i, /\[.*\]/];

export function hasBlockedPlaceholders(text: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(text));
}

export async function guardAndRegenerateOnce(input: {
  text: string;
  regenerate: (strictPromptSuffix: string) => Promise<string>;
}): Promise<string> {
  if (!hasBlockedPlaceholders(input.text)) return input.text;
  const regenerated = await input.regenerate("Regenerate strictly: no placeholders, no brackets, no TODO/TBD tokens.");
  return regenerated;
}
