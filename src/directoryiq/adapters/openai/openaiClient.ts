import "server-only";

import { generateListingUpgradeDraft } from "@/lib/openai/serverClient";

export async function runOpenAiText(params: { apiKey: string; prompt: string }): Promise<string> {
  return generateListingUpgradeDraft({
    apiKey: params.apiKey,
    prompt: params.prompt,
  });
}
