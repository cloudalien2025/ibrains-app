export type DescriptionDiffRow = {
  left: string;
  right: string;
  type: "same" | "added" | "removed" | "changed";
};

export function buildDescriptionDiff(beforeText: string, afterText: string): DescriptionDiffRow[] {
  const before = beforeText.split(/\r?\n/);
  const after = afterText.split(/\r?\n/);
  const max = Math.max(before.length, after.length);
  const rows: DescriptionDiffRow[] = [];

  for (let index = 0; index < max; index += 1) {
    const left = before[index] ?? "";
    const right = after[index] ?? "";
    if (left === right) {
      rows.push({ left, right, type: "same" });
      continue;
    }
    if (!left && right) {
      rows.push({ left: "", right, type: "added" });
      continue;
    }
    if (left && !right) {
      rows.push({ left, right: "", type: "removed" });
      continue;
    }
    rows.push({ left, right, type: "changed" });
  }

  return rows;
}
