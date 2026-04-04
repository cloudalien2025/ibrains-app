export type CylinderVisualStage =
  | "telemetry_absent"
  | "collected_only"
  | "processed_not_activated"
  | "activated";

export type CylinderVisualState = {
  stage: CylinderVisualStage;
  signalBoost: number;
  glowBoost: number;
  fillMultiplier: number;
  minFillPct: number;
  driftDurationSec: number;
  breatheDurationSec: number;
  surfaceBoost: number;
  shimmerBoost: number;
  poolBoost: number;
};

export function deriveCylinderVisualState(input: {
  collected: number | null;
  normalized: number | null;
  classified: number | null;
  summarized: number | null;
  processedCount: number | null;
  activated: number | null;
}): CylinderVisualState {
  const hasTelemetry =
    input.normalized != null ||
    input.classified != null ||
    input.summarized != null ||
    input.processedCount != null ||
    input.activated != null;
  const collected = input.collected ?? 0;
  const processed = input.processedCount ?? 0;
  const activated = input.activated ?? 0;

  if (!hasTelemetry) {
    return {
      stage: "telemetry_absent",
      signalBoost: 0.62,
      glowBoost: 0.5,
      fillMultiplier: 0.8,
      minFillPct: 4,
      driftDurationSec: 24,
      breatheDurationSec: 9,
      surfaceBoost: 0.45,
      shimmerBoost: 0.55,
      poolBoost: 0.5,
    };
  }

  if (activated > 0) {
    return {
      stage: "activated",
      signalBoost: 1.28,
      glowBoost: 1.25,
      fillMultiplier: 1.03,
      minFillPct: 8,
      driftDurationSec: 10,
      breatheDurationSec: 5.6,
      surfaceBoost: 1.18,
      shimmerBoost: 1.15,
      poolBoost: 1.2,
    };
  }

  if (processed > 0) {
    return {
      stage: "processed_not_activated",
      signalBoost: 1.08,
      glowBoost: 1.02,
      fillMultiplier: 1,
      minFillPct: 7,
      driftDurationSec: 12.5,
      breatheDurationSec: 6.4,
      surfaceBoost: 1.05,
      shimmerBoost: 1.02,
      poolBoost: 1,
    };
  }

  if (collected > 0) {
    return {
      stage: "collected_only",
      signalBoost: 0.84,
      glowBoost: 0.72,
      fillMultiplier: 0.9,
      minFillPct: 6,
      driftDurationSec: 18,
      breatheDurationSec: 7.4,
      surfaceBoost: 0.78,
      shimmerBoost: 0.76,
      poolBoost: 0.74,
    };
  }

  return {
    stage: "telemetry_absent",
    signalBoost: 0.62,
    glowBoost: 0.5,
    fillMultiplier: 0.8,
    minFillPct: 4,
    driftDurationSec: 24,
    breatheDurationSec: 9,
    surfaceBoost: 0.45,
    shimmerBoost: 0.55,
    poolBoost: 0.5,
  };
}
