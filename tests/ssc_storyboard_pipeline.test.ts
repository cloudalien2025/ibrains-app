import { describe, expect, it } from "vitest";

type Score = {
  dimension: string;
  score: number;
  reasons: Array<{ title: string; explanation: string; quote: string | null }>;
  flags: string[];
};

type LlmClient = {
  generate: (input: { userPrompt: string }) => Promise<string>;
};

const VISUAL_DIMENSIONS = [
  "VIS_primary_entity_clarity",
  "VIS_key_benefit_visibility",
  "VIS_information_hierarchy",
] as const;

type StoryboardRun = {
  id: string;
  entityType: string;
  entityId: string;
  scores: Score[];
};

class MemorySscStore {
  private readonly runs: StoryboardRun[] = [];

  async createStoryboardRun(input: StoryboardRun): Promise<StoryboardRun> {
    this.runs.push(input);
    return input;
  }

  async getLatestStoryboardRun(entityType: string, entityId: string): Promise<StoryboardRun | null> {
    for (let i = this.runs.length - 1; i >= 0; i -= 1) {
      const run = this.runs[i];
      if (run.entityType === entityType && run.entityId === entityId) {
        return run;
      }
    }
    return null;
  }
}

function createMemoryStorage() {
  return {
    adapter: {
      async putBytes(_key: string, _value: Uint8Array) {
        return;
      },
      async getBytes(_key: string) {
        return new Uint8Array();
      },
    },
  };
}

async function persistPromptPacks(_store: MemorySscStore, _storage: { putBytes: (key: string, value: Uint8Array) => Promise<void> }) {
  return;
}

async function runStoryboardEvaluation(input: {
  store: MemorySscStore;
  storage: { putBytes: (key: string, value: Uint8Array) => Promise<void> };
  llm: LlmClient;
  entityType: string;
  entityId: string;
  url: string;
  screenshotBytes: Buffer;
  visibleText: string;
}) {
  await input.storage.putBytes(`ssc/${input.entityType}/${input.entityId}.png`, new Uint8Array(input.screenshotBytes));

  const scores: Score[] = [];
  for (const dimension of VISUAL_DIMENSIONS) {
    const raw = await input.llm.generate({
      userPrompt: JSON.stringify({ dimension, url: input.url, visible_text: input.visibleText }),
    });
    scores.push(JSON.parse(raw) as Score);
  }

  const run = await input.store.createStoryboardRun({
    id: `run_${Date.now()}`,
    entityType: input.entityType,
    entityId: input.entityId,
    scores,
  });

  return { run, scores };
}

function createFakeLlm(): LlmClient {
  return {
    async generate({ userPrompt }: { userPrompt: string }) {
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
