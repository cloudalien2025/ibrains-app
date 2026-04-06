type AnyRecord = Record<string, unknown>;

export type CreateBrainInput = {
  name: string;
  slug: string;
  description: string;
  domain: string;
  agentName: string;
  status?: string;
};

export type CreateBrainValidation =
  | { ok: true; data: CreateBrainInput }
  | { ok: false; message: string; field?: keyof CreateBrainInput };

function readString(payload: AnyRecord, key: string): string {
  const value = payload[key];
  if (typeof value !== "string") return "";
  return value.trim();
}

export function normalizeBrainSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidBrainSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function validateCreateBrainPayload(payload: unknown): CreateBrainValidation {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, message: "Body must be a JSON object." };
  }

  const record = payload as AnyRecord;
  const name = readString(record, "name");
  const slug = normalizeBrainSlug(readString(record, "slug"));
  const description = readString(record, "description");
  const domain = readString(record, "domain");
  const agentName = readString(record, "agentName");
  const status = readString(record, "status") || "active";

  if (!name) return { ok: false, field: "name", message: "Brain Name is required." };
  if (!slug) return { ok: false, field: "slug", message: "Slug is required." };
  if (!isValidBrainSlug(slug)) {
    return {
      ok: false,
      field: "slug",
      message: "Slug must use lowercase letters, numbers, and single hyphens.",
    };
  }
  if (!description) {
    return { ok: false, field: "description", message: "Description is required." };
  }
  if (!domain) return { ok: false, field: "domain", message: "Domain is required." };
  if (!agentName) {
    return { ok: false, field: "agentName", message: "Agent Name is required." };
  }

  return {
    ok: true,
    data: {
      name,
      slug,
      description,
      domain,
      agentName,
      status,
    },
  };
}

export function toCreateBrainUpstreamPayload(input: CreateBrainInput): AnyRecord {
  return {
    name: input.name,
    slug: input.slug,
    description: input.description,
    domain: input.domain,
    agent_name: input.agentName,
    agentName: input.agentName,
    status: input.status || "active",
    brain_type: "custom",
  };
}

export function extractBrainSlug(brain: unknown): string | null {
  if (!brain || typeof brain !== "object") return null;
  const candidate = brain as AnyRecord;
  const raw = candidate.slug ?? candidate.brain_slug ?? candidate.id ?? candidate.brain_id;
  if (typeof raw !== "string") return null;
  const normalized = normalizeBrainSlug(raw);
  return normalized.length ? normalized : null;
}
