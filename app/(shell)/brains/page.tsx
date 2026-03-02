import { headers } from "next/headers";
import BrainsTable, { type BrainDockView } from "./_components/BrainsTable";
import { brainCatalog } from "@/lib/brains/brainCatalog";
import { entitledBrainMap, resolveUserFromHeaders } from "@/lib/auth/entitlements";

type BrainRecord = Record<string, unknown>;

function resolveBrains(payload: unknown): BrainRecord[] {
  if (Array.isArray(payload)) return payload as BrainRecord[];
  if (payload && typeof payload === "object") {
    const candidate = payload as Record<string, unknown>;
    const list =
      (candidate.brains as unknown[]) ||
      (candidate.items as unknown[]) ||
      (candidate.data as unknown[]) ||
      [];
    if (Array.isArray(list)) return list as BrainRecord[];
  }
  return [];
}

function normalizeBrainRecord(brain: BrainRecord): { id: string; lastUpdated?: string | null } {
  const id =
    String(brain.brain_id ?? brain.id ?? brain.slug ?? brain.key ?? "").trim().toLowerCase() ||
    "unknown_brain";
  const lastUpdated =
    (brain.last_updated as string | undefined) ??
    (brain.updated_at as string | undefined) ??
    (brain.last_run_at as string | undefined) ??
    (brain.created_at as string | undefined) ??
    null;

  return { id, lastUpdated };
}

async function loadLastUpdatedByBrainId(baseUrl: string): Promise<Record<string, string | null | undefined>> {
  try {
    const res = await fetch(`${baseUrl}/api/brains`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return {};

    const payload = await res.json().catch(() => null);
    const list = resolveBrains(payload);
    return list.reduce<Record<string, string | null | undefined>>((acc, brain) => {
      const normalized = normalizeBrainRecord(brain);
      acc[normalized.id] = normalized.lastUpdated;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export default async function BrainsPage() {
  const headersList = await headers();
  const host = headersList.get("host");
  const baseUrl = host ? `http://${host}` : "http://127.0.0.1:3001";

  const user = resolveUserFromHeaders(headersList);
  const entitlementMap = entitledBrainMap(user);
  const lastUpdatedByBrainId = await loadLastUpdatedByBrainId(baseUrl);

  const brains: BrainDockView[] = brainCatalog.map((brain) => ({
    ...brain,
    entitled: entitlementMap[brain.id],
    lastUpdated: lastUpdatedByBrainId[brain.id] ?? null,
  }));

  return <BrainsTable brains={brains} />;
}
