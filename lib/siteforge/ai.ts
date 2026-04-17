export const siteforgeSupportedOpenAiModels = ["gpt-4.1-mini", "gpt-4.1", "gpt-5-mini"] as const;

export type SiteForgeOpenAiModel = (typeof siteforgeSupportedOpenAiModels)[number];

export type ResolvedAiProvider = {
  source: "user_key" | "platform_key" | "none";
  model: SiteForgeOpenAiModel;
  apiKey: string | null;
};

export function normalizeOpenAiModel(value: unknown): SiteForgeOpenAiModel {
  if (typeof value === "string" && (siteforgeSupportedOpenAiModels as readonly string[]).includes(value)) {
    return value as SiteForgeOpenAiModel;
  }
  return "gpt-4.1-mini";
}

export function resolvePlatformOpenAiKey(): string | null {
  const raw = process.env.SITEFORGE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";
  const key = raw.trim();
  return key ? key : null;
}
