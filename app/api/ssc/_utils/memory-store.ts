import type {
  PromptPackRecord,
  PromptRecord,
  StoryboardRunRecord,
  StoryboardScoreRecord,
} from "./types";
import type {
  ActivePromptPack,
  ActivePromptResult,
  SscStore,
  StoryboardRunWithScores,
} from "./store";

export class MemorySscStore implements SscStore {
  private packs = new Map<string, PromptPackRecord>();
  private prompts = new Map<string, PromptRecord>();
  private active = new Map<string, string>();
  private storyboardRuns = new Map<string, StoryboardRunRecord>();
  private storyboardScores = new Map<string, StoryboardScoreRecord[]>();

  async upsertPromptPack(pack: Omit<PromptPackRecord, "id">): Promise<string> {
    const id = crypto.randomUUID();
    const record: PromptPackRecord = { id, ...pack };
    this.packs.set(id, record);
    return id;
  }

  async upsertPrompt(prompt: Omit<PromptRecord, "id">): Promise<string> {
    const id = crypto.randomUUID();
    const record: PromptRecord = { id, ...prompt };
    this.prompts.set(id, record);
    return id;
  }

  async setActivePack(packName: string, packId: string): Promise<void> {
    this.active.set(packName, packId);
  }

  async listPromptPacks(): Promise<ActivePromptPack[]> {
    return Array.from(this.packs.values()).map((pack) => ({
      ...pack,
      active: this.active.get(pack.pack_name) === pack.id,
      active_updated_at: null,
    }));
  }

  async getPromptPackByName(packName: string): Promise<ActivePromptPack | null> {
    const pack = Array.from(this.packs.values()).find(
      (record) => record.pack_name === packName
    );
    if (!pack) return null;
    return {
      ...pack,
      active: this.active.get(pack.pack_name) === pack.id,
      active_updated_at: null,
    };
  }

  async getActivePrompt(
    packName: string,
    dimension: string
  ): Promise<ActivePromptResult | null> {
    const packId = this.active.get(packName);
    if (!packId) return null;
    const pack = this.packs.get(packId);
    if (!pack) return null;
    const prompt = Array.from(this.prompts.values()).find(
      (record) => record.pack_id === packId && record.dimension === dimension
    );
    if (!prompt) return null;
    return { pack, prompt };
  }

  async createStoryboardRun(run: StoryboardRunRecord): Promise<void> {
    this.storyboardRuns.set(run.id, run);
  }

  async createStoryboardScore(score: StoryboardScoreRecord): Promise<void> {
    const list = this.storyboardScores.get(score.run_id) ?? [];
    list.push({ ...score, id: score.id ?? crypto.randomUUID() });
    this.storyboardScores.set(score.run_id, list);
  }

  async getLatestStoryboardRun(
    entityType: string,
    entityId: string
  ): Promise<StoryboardRunWithScores | null> {
    const runs = Array.from(this.storyboardRuns.values()).filter(
      (run) => run.entity_type === entityType && run.entity_id === entityId
    );
    if (!runs.length) return null;
    const run = runs[runs.length - 1];
    const scores = this.storyboardScores.get(run.id) ?? [];
    return { ...run, scores };
  }
}
