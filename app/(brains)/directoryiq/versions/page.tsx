import { headers } from "next/headers";
import DirectoryIqVersionsClient from "./directoryiq-versions-client";

type VersionRow = {
  id: string;
  listing_source_id: string;
  action_type: string;
  version_label: string;
  score_snapshot_json: Record<string, unknown>;
  content_delta_json: Record<string, unknown>;
  link_delta_json: Record<string, unknown>;
  created_at: string;
};

async function loadVersions(): Promise<{ versions: VersionRow[]; error: string | null }> {
  const headersList = await headers();
  const host = headersList.get("host");
  const baseUrl = host ? `http://${host}` : "http://127.0.0.1:3001";

  try {
    const response = await fetch(`${baseUrl}/api/directoryiq/versions`, { cache: "no-store" });
    const json = (await response.json().catch(() => ({}))) as { versions?: VersionRow[]; error?: string };
    if (!response.ok) {
      return { versions: [], error: json.error ?? "Failed to load versions" };
    }
    return { versions: json.versions ?? [], error: null };
  } catch (e) {
    return { versions: [], error: e instanceof Error ? e.message : "Failed to load versions" };
  }
}

export const dynamic = "force-dynamic";

export default async function DirectoryIqVersionsPage() {
  const { versions, error } = await loadVersions();
  return <DirectoryIqVersionsClient initialRows={versions} initialError={error} />;
}
