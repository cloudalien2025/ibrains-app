import { describe, expect, it } from "vitest";
import { normalizeRun, selectRunsForBrain } from "@/lib/brains/missionControlRunSelection";

describe("mission control run selection", () => {
  it("normalizes brain_slug and selects DirectoryIQ runs by resolved brain id", () => {
    const payload = {
      runs: [
        {
          run_id: "run_dir_1",
          brain_slug: "brilliant_directories",
          status: "completed",
          updated_at: "2026-04-04T04:28:30.327548+00:00",
        },
      ],
    };

    const normalized = normalizeRun(payload.runs[0]);
    expect(normalized.brainId).toBe("brilliant_directories");

    const selected = selectRunsForBrain(payload, "directoryiq", 6);
    expect(selected).toHaveLength(1);
    expect(selected[0]?.id).toBe("run_dir_1");
  });

  it("does not cross-select runs for unrelated brains", () => {
    const payload = {
      runs: [
        { run_id: "run_dir_1", brain_slug: "brilliant_directories" },
        { run_id: "run_ecom_1", brain_slug: "ecomviper" },
      ],
    };

    const selected = selectRunsForBrain(payload, "ecomviper", 6);
    expect(selected).toHaveLength(1);
    expect(selected[0]?.id).toBe("run_ecom_1");
  });
});
