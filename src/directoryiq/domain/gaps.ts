import { Gap, PillarName } from "@/src/directoryiq/domain/types";
import { PILLARS } from "@/src/directoryiq/domain/pillars";

export function normalizeGapsByPillar(input: unknown): Record<PillarName, string[]> {
  const output: Record<PillarName, string[]> = {
    structure: [],
    clarity: [],
    trust: [],
    authority: [],
    actionability: [],
  };

  if (!input || typeof input !== "object") return output;
  const data = input as Record<string, unknown>;
  for (const pillar of PILLARS) {
    const rows = data[pillar];
    if (!Array.isArray(rows)) continue;
    output[pillar] = rows
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return output;
}

export function flattenGaps(gapsByPillar: Record<PillarName, string[]>): Gap[] {
  const out: Gap[] = [];
  for (const pillar of PILLARS) {
    for (const message of gapsByPillar[pillar]) {
      out.push({
        pillar,
        code: `${pillar.toUpperCase()}_GAP`,
        message,
        severity: "medium",
      });
    }
  }
  return out;
}
