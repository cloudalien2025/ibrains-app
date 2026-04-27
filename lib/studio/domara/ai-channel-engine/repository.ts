import type {
  CasaHudGenerationRun,
  CasaHudOrchestratorOutput,
  CasaHudProject,
  CasaHudStageRecord,
} from "@/lib/studio/domara/ai-channel-engine/types";

export interface CasaHudProductionRepository {
  createRun(run: CasaHudGenerationRun): Promise<void>;
  updateRun(run: CasaHudGenerationRun): Promise<void>;
  createProject(project: CasaHudProject): Promise<void>;
  saveStage(runId: string, stage: CasaHudStageRecord): Promise<void>;
  saveOutput(output: CasaHudOrchestratorOutput): Promise<void>;
}

export class InMemoryCasaHudRepository implements CasaHudProductionRepository {
  readonly runs = new Map<string, CasaHudGenerationRun>();
  readonly projects = new Map<string, CasaHudProject>();
  readonly stages = new Map<string, CasaHudStageRecord[]>();
  readonly outputs = new Map<string, CasaHudOrchestratorOutput>();

  async createRun(run: CasaHudGenerationRun): Promise<void> {
    this.runs.set(run.id, run);
  }

  async updateRun(run: CasaHudGenerationRun): Promise<void> {
    this.runs.set(run.id, run);
  }

  async createProject(project: CasaHudProject): Promise<void> {
    this.projects.set(project.id, project);
  }

  async saveStage(runId: string, stage: CasaHudStageRecord): Promise<void> {
    const current = this.stages.get(runId) || [];
    this.stages.set(runId, [...current.filter((item) => item.name !== stage.name), stage]);
  }

  async saveOutput(output: CasaHudOrchestratorOutput): Promise<void> {
    this.outputs.set(output.run.id, output);
  }
}
