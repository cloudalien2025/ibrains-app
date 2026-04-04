import { describe, expect, it } from "vitest";
import { deriveCylinderVisualState } from "@/lib/brains/cylinderVisualState";

describe("deriveCylinderVisualState", () => {
  it("maps absent telemetry to subdued state", () => {
    const state = deriveCylinderVisualState({
      collected: 66,
      normalized: null,
      classified: null,
      summarized: null,
      processedCount: null,
      activated: null,
    });

    expect(state.stage).toBe("telemetry_absent");
    expect(state.glowBoost).toBeLessThan(1);
  });

  it("maps processed but not activated to energized incomplete state", () => {
    const state = deriveCylinderVisualState({
      collected: 14,
      normalized: 5,
      classified: 3,
      summarized: 1,
      processedCount: 1,
      activated: 0,
    });

    expect(state.stage).toBe("processed_not_activated");
    expect(state.glowBoost).toBeGreaterThan(1);
  });

  it("maps activated payload to strongest state", () => {
    const state = deriveCylinderVisualState({
      collected: 14,
      normalized: 8,
      classified: 8,
      summarized: 8,
      processedCount: 8,
      activated: 3,
    });

    expect(state.stage).toBe("activated");
    expect(state.signalBoost).toBeGreaterThan(1.2);
  });
});
