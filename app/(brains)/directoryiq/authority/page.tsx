import { headers } from "next/headers";
import AuthorityOverviewClient from "./authority-overview-client";

type Overview = {
  totalNodes: number;
  totalEdges: number;
  totalEvidence: number;
  blogNodes: number;
  listingNodes: number;
  lastIngestionRunAt: string | null;
  lastGraphRunAt: string | null;
  lastGraphRunStatus: string | null;
};

const EMPTY: Overview = {
  totalNodes: 0,
  totalEdges: 0,
  totalEvidence: 0,
  blogNodes: 0,
  listingNodes: 0,
  lastIngestionRunAt: null,
  lastGraphRunAt: null,
  lastGraphRunStatus: null,
};

async function loadOverview(): Promise<{ overview: Overview; error: string | null }> {
  const headersList = await headers();
  const host = headersList.get("host");
  const baseUrl = host ? `http://${host}` : "http://127.0.0.1:3001";

  try {
    const response = await fetch(`${baseUrl}/api/directoryiq/authority/overview`, { cache: "no-store" });
    const json = (await response.json().catch(() => ({}))) as { overview?: Overview; error?: { message?: string } };
    if (!response.ok) {
      return { overview: EMPTY, error: json.error?.message ?? "Failed to load overview." };
    }
    return { overview: json.overview ?? EMPTY, error: null };
  } catch (e) {
    return { overview: EMPTY, error: e instanceof Error ? e.message : "Failed to load overview." };
  }
}

export const dynamic = "force-dynamic";

export default async function DirectoryIqAuthorityOverviewPage() {
  const { overview, error } = await loadOverview();
  return <AuthorityOverviewClient initialOverview={overview} initialError={error} />;
}
