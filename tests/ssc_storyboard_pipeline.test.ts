import { describe, expect, it } from "vitest";
import { MemorySscStore } from "../app/api/ssc/_utils/memory-store";
import { createMemoryStorage } from "../app/api/ssc/_utils/storage";
import { persistPromptPacks } from "../app/api/ssc/_utils/promptPacks";
import { runStoryboardEvaluation, VISUAL_DIMENSIONS } from "../app/api/ssc/_utils/service";
import type { LlmClient } from "../app/api/ssc/_utils/llm";

function createFakeLlm(): LlmClient {
  return {
    async generate({ userPrompt }) {
      const match = userPrompt.match(/"dimension":\s*"([A-Za-z0-9_]+)"/);
      const dimension = match?.[1] ?? "VIS_primary_entity_clarity";
      return JSON.stringify({
        dimension,
        score: 12,
        reasons: [
          { title: "Reason 1", explanation: "Short explanation.", quote: null },
          { title: "Reason 2", explanation: "Short explanation.", quote: null },
          { title: "Reason 3", explanation: "Short explanation.", quote: null },
        ],
        flags: [],
      });
    },
  };
}

describe("SSC storyboard pipeline", () => {
  it("persists run and scores", async () => {
    const store = new MemorySscStore();
    const memory = createMemoryStorage();
    await persistPromptPacks(store, memory.adapter);

    const result = await runStoryboardEvaluation({
      store,
      storage: memory.adapter,
      llm: createFakeLlm(),
      entityType: "shopify_product",
      entityId: "123",
      url: "https://example.com/product/123",
      screenshotBytes: Buffer.from("fake-png"),
      visibleText: "Sample visible text",
    });

    expect(result.run.id).toBeTruthy();
    expect(result.scores).toHaveLength(VISUAL_DIMENSIONS.length);

    const latest = await store.getLatestStoryboardRun("shopify_product", "123");
    expect(latest).not.toBeNull();
    expect(latest?.scores.length).toBe(VISUAL_DIMENSIONS.length);
  });
});
