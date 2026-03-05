import { headers } from "next/headers";
import AuthoritySupportClient from "./authority-support-client";

type GraphIssuesPayload = {
  orphans: unknown[];
  mentions_without_links: unknown[];
  weak_anchors: unknown[];
  lastRun: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    stats: Record<string, unknown>;
  } | null;
};

async function loadIssues(): Promise<{ issues: GraphIssuesPayload; error: string | null }> {
  const headersList = await headers();
  const host = headersList.get("host");
  const baseUrl = host ? `http://${host}` : "http://127.0.0.1:3001";

  try {
    const res = await fetch(`${baseUrl}/api/directoryiq/graph/issues`, { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as { issues?: GraphIssuesPayload; error?: { message?: string } };
    if (!res.ok || !json.issues) {
      return {
        issues: { orphans: [], mentions_without_links: [], weak_anchors: [], lastRun: null },
        error: json.error?.message ?? "Failed to load authority graph issues.",
      };
    }
    return { issues: json.issues, error: null };
  } catch (e) {
    return {
      issues: { orphans: [], mentions_without_links: [], weak_anchors: [], lastRun: null },
      error: e instanceof Error ? e.message : "Failed to load authority graph issues.",
    };
  }
}

export const dynamic = "force-dynamic";

export default async function DirectoryIQAuthoritySupportPage() {
  const { issues, error } = await loadIssues();
  return <AuthoritySupportClient initialIssues={issues} initialError={error} />;
}
