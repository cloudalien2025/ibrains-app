import { DiffRow } from "@/src/directoryiq/domain/types";
import { buildDescriptionDiff } from "@/src/lib/directoryiq/descriptionDiff";

export function buildDiffRows(originalText: string, proposedText: string): DiffRow[] {
  return buildDescriptionDiff(originalText, proposedText);
}
