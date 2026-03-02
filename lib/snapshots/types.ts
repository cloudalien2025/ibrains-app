export type SnapshotBrainId = "directoryiq" | "ecomviper";
export type SnapshotStatus = "up_to_date" | "updating" | "needs_connection" | "error";
export type SnapshotMetricState = "ready" | "loading" | "stale";

export type SnapshotMetric = {
  key: string;
  label: string;
  value: string | number | null;
  unit?: string;
  state: SnapshotMetricState;
};

export type SnapshotResponse = {
  brain_id: SnapshotBrainId;
  status: SnapshotStatus;
  updated_at: string | null;
  metrics: SnapshotMetric[];
  connection_type?: "bd" | "shopify" | "sitemap" | null;
  hints?: string[];
  last_error?: string | null;
};

export const SNAPSHOT_REFRESH_THRESHOLD_MS = 6 * 60 * 60 * 1000;
export const SNAPSHOT_LOCK_TTL_MS = 10 * 60 * 1000;

export const DIRECTORYIQ_METRIC_DEFS = [
  { key: "total_surfaces_count", label: "Total Surfaces" },
  { key: "blog_surfaces_count", label: "Blog Surfaces" },
  { key: "listing_like_count", label: "Listing-like Surfaces" },
  { key: "schema_coverage_percent", label: "Schema Coverage %" },
  { key: "last_analyzed", label: "Last Analyzed" },
  { key: "connection_type", label: "Connection Type" },
] as const;

export const ECOMVIPER_METRIC_DEFS = [
  { key: "total_surfaces_count", label: "Total Surfaces" },
  { key: "product_surfaces_count", label: "Product Surfaces" },
  { key: "blog_surfaces_count", label: "Blog Surfaces" },
  { key: "trust_surfaces_present", label: "Trust Surfaces Present" },
  { key: "schema_coverage_percent", label: "Schema Coverage %" },
  { key: "last_analyzed", label: "Last Analyzed" },
] as const;

export function metricTemplate(brainId: SnapshotBrainId, state: SnapshotMetricState): SnapshotMetric[] {
  const defs = brainId === "directoryiq" ? DIRECTORYIQ_METRIC_DEFS : ECOMVIPER_METRIC_DEFS;
  return defs.map((def) => ({ key: def.key, label: def.label, value: null, state }));
}

export function isSnapshotStale(updatedAtIso: string | null): boolean {
  if (!updatedAtIso) return true;
  const parsed = Date.parse(updatedAtIso);
  if (!Number.isFinite(parsed)) return true;
  return Date.now() - parsed > SNAPSHOT_REFRESH_THRESHOLD_MS;
}

export function withMetricState(
  metrics: SnapshotMetric[],
  state: SnapshotMetricState
): SnapshotMetric[] {
  return metrics.map((metric) => ({ ...metric, state: metric.value == null ? "loading" : state }));
}
