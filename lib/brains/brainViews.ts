import {
  brainCatalogById,
  isBrainId,
  type BrainId,
  type BrainViewEntry,
} from "@/lib/brains/brainCatalog";

type BrainRecord = Record<string, unknown>;

const genericTags = ["Custom Brain", "Knowledge Readiness", "Mission Control"];

function toStringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function resolveBrains(payload: unknown): BrainRecord[] {
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

export function resolveBrainRecordId(brain: BrainRecord): string {
  return (
    toStringValue(brain.brain_id) ||
    toStringValue(brain.id) ||
    toStringValue(brain.slug) ||
    toStringValue(brain.key) ||
    "unknown_brain"
  );
}

function defaultNameFromId(id: string): string {
  return id
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Unnamed Brain";
}

export function normalizeBrainRecord(brain: BrainRecord): BrainViewEntry {
  const id = resolveBrainRecordId(brain);
  const name =
    toStringValue(brain.displayName) ||
    toStringValue(brain.display_name) ||
    toStringValue(brain.name) ||
    toStringValue(brain.title) ||
    toStringValue(brain.brain_name) ||
    defaultNameFromId(id);

  if (isBrainId(id)) {
    const knownId = id as BrainId;
    return {
      ...brainCatalogById[knownId],
      name,
    };
  }

  const description =
    toStringValue(brain.description) ||
    toStringValue(brain.short_description) ||
    toStringValue(brain.domain) ||
    "Custom operational brain ready for discovery, ingest, retrieval, and answering.";

  return {
    id,
    name,
    shortDescription: description,
    tags: genericTags,
    primaryCtaText: "Open Console",
    upsellTitle: `Unlock ${name}`,
    upsellMessage: `Activate ${name} to run discovery, ingest, retrieval, and answering workflows.`,
    iconKey: "map",
  };
}

export function normalizeBrainList(payload: unknown): BrainViewEntry[] {
  return resolveBrains(payload).map(normalizeBrainRecord);
}
