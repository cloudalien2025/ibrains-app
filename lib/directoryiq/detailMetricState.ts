export type DetailMetricStateInput = {
  loading: boolean;
  unresolved: boolean;
  value: number | null | undefined;
};

export function resolveDetailMetricDisplayValue(input: DetailMetricStateInput): string {
  if (input.loading) return "...";
  if (input.unresolved || input.value == null) return "—";
  return String(input.value);
}

