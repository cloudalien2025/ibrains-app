import { describe, expect, it, vi } from "vitest";
import {
  ECOMVIPER_METRIC_DEFS,
  DIRECTORYIQ_METRIC_DEFS,
  isSnapshotStale,
  metricTemplate,
  withMetricState,
} from "../lib/snapshots/types";

describe("snapshot contract helpers", () => {
  it("creates metric templates for both brains", () => {
    const directoryMetrics = metricTemplate("directoryiq", "loading");
    const ecomMetrics = metricTemplate("ecomviper", "loading");

    expect(directoryMetrics).toHaveLength(DIRECTORYIQ_METRIC_DEFS.length);
    expect(ecomMetrics).toHaveLength(ECOMVIPER_METRIC_DEFS.length);
    expect(directoryMetrics.every((metric) => metric.state === "loading")).toBe(true);
  });

  it("marks snapshot stale when older than threshold", () => {
    const now = new Date("2026-02-28T12:00:00.000Z").valueOf();
    vi.spyOn(Date, "now").mockReturnValue(now);

    expect(isSnapshotStale("2026-02-28T11:00:00.000Z")).toBe(false);
    expect(isSnapshotStale("2026-02-28T03:00:00.000Z")).toBe(true);
    expect(isSnapshotStale(null)).toBe(true);
  });

  it("preserves loading state for null values when marking stale", () => {
    const stale = withMetricState(
      [
        { key: "a", label: "A", value: 12, state: "ready" },
        { key: "b", label: "B", value: null, state: "ready" },
      ],
      "stale"
    );

    expect(stale[0].state).toBe("stale");
    expect(stale[1].state).toBe("loading");
  });
});
