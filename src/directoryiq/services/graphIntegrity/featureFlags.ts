export type GraphIntegrityGate = {
  enabled: boolean;
  reason: string;
};

function readCsv(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function resolveGraphIntegrityGate(params: {
  tenantId: string;
  userFeatures?: string[] | null;
}): GraphIntegrityGate {
  const tenantId = params.tenantId || "default";
  const allowlist = new Set(readCsv(process.env.DIRECTORYIQ_GRAPH_INTEGRITY_TENANTS));
  const userFeatures = new Set((params.userFeatures ?? []).map((feature) => feature.toLowerCase()));

  if (allowlist.has("*") || allowlist.has(tenantId)) {
    return { enabled: true, reason: "tenant_allowlist" };
  }

  if (userFeatures.has("directoryiq_graph_integrity_v2") || userFeatures.has("graph_integrity_v2")) {
    return { enabled: true, reason: "user_feature" };
  }

  return { enabled: false, reason: "feature_not_enabled" };
}
