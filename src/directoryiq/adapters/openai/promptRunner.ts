import "server-only";

import { runOpenAiText } from "@/src/directoryiq/adapters/openai/openaiClient";

export async function runUpgradePrompt(apiKey: string, prompt: string): Promise<string> {
  return runOpenAiText({ apiKey, prompt });
}
