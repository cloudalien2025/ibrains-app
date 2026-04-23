import { PillarName } from "@/src/directoryiq/domain/types";

export const PILLARS: PillarName[] = ["structure", "clarity", "trust", "authority", "actionability"];

export function isPillarName(value: string): value is PillarName {
  return (PILLARS as string[]).includes(value);
}

export function emptyPillarScores(defaultValue = 0): Record<PillarName, number> {
  return {
    structure: defaultValue,
    clarity: defaultValue,
    trust: defaultValue,
    authority: defaultValue,
    actionability: defaultValue,
  };
}
