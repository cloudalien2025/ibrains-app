import type { GraphIssue, GraphIssuesPayload } from "@/src/directoryiq/domain/authorityGraph";

function normalizeIssues(input: unknown): GraphIssuesPayload {
  const raw = input && typeof input === "object" ? (input as Partial<GraphIssuesPayload>) : {};
  const orphans = Array.isArray(raw.orphans) ? (raw.orphans as GraphIssue[]) : [];
  const mentions = Array.isArray(raw.mentions_without_links) ? (raw.mentions_without_links as GraphIssue[]) : [];
  const weakAnchors = Array.isArray(raw.weak_anchors) ? (raw.weak_anchors as GraphIssue[]) : [];
  const lastRun =
    raw.lastRun && typeof raw.lastRun === "object" ? (raw.lastRun as GraphIssuesPayload["lastRun"]) : null;

  return {
    orphans,
    mentions_without_links: mentions,
    weak_anchors: weakAnchors,
    lastRun,
  };
}

export function authoritySupportBaseUrl(host: string | null): string {
  return host ? `http://${host}` : "http://127.0.0.1:3001";
}

export async function loadAuthoritySupportInitialIssues(baseUrl: string): Promise<{
  issues: GraphIssuesPayload;
  error: string | null;
}> {
  try {
    const res = await fetch(`${baseUrl}/api/directoryiq/graph/issues`, { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as { issues?: unknown; error?: { message?: string } };
    if (!res.ok || !json.issues) {
      return {
        issues: normalizeIssues(null),
        error: json.error?.message ?? "Failed to load authority graph issues.",
      };
    }

    return { issues: normalizeIssues(json.issues), error: null };
  } catch (e) {
    return {
      issues: normalizeIssues(null),
      error: e instanceof Error ? e.message : "Failed to load authority graph issues.",
    };
  }
}
