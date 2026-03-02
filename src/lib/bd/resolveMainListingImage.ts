import { normalizeBdUrl } from "@/src/lib/images/normalizeBdUrl";

type JsonObject = Record<string, unknown>;

type FetchBdJson = (params: {
  method: "GET" | "POST";
  path: string;
  form?: Record<string, string | number>;
}) => Promise<JsonObject | null>;

export type ResolveMainListingImageInput = {
  bdBaseUrl: string;
  userPayload: JsonObject | null;
  fetchBdJson?: FetchBdJson;
};

export type ResolveMainListingImageResult = {
  url: string | null;
  source: string;
  attempts: string[];
  evidence?: {
    fieldPath?: string;
    portfolio?: {
      groupId?: string;
      photoId?: string;
      endpoint?: string;
      status?: string;
    };
    fallback?: {
      reason: string;
    };
  };
};

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function firstArray(payload: JsonObject | null): unknown[] {
  return asArray(payload?.message ?? payload?.results ?? payload?.records ?? payload?.data);
}

function extractPortfolioEntriesFromGroupPayload(payload: JsonObject | null): unknown[] {
  const messageObj = asObject(payload?.message);
  if (messageObj) {
    const direct = asArray(messageObj.users_portfolio ?? messageObj.portfolio ?? messageObj.photos);
    if (direct.length > 0) return direct;
  }

  const messageRows = asArray(payload?.message);
  for (const row of messageRows) {
    const obj = asObject(row);
    if (!obj) continue;
    const nested = asArray(obj.users_portfolio ?? obj.portfolio ?? obj.photos);
    if (nested.length > 0) return nested;
  }

  return [];
}

function readPath(obj: JsonObject | null, path: string): unknown {
  if (!obj) return null;
  let current: unknown = obj;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object") return null;
    current = (current as JsonObject)[part];
  }
  return current;
}

function unwrapPayload(payload: JsonObject | null): JsonObject | null {
  if (!payload) return null;
  const direct = asObject(payload.message);
  if (direct) return direct;
  return payload;
}

function pickFromPortfolioEntries(params: {
  bdBaseUrl: string;
  entries: unknown[];
}): { url: string | null; fieldPath: string | null; photoId: string | null; attempts: string[] } {
  const rows = params.entries.map(asObject).filter(Boolean) as JsonObject[];
  const attempts: string[] = [];
  if (rows.length === 0) {
    attempts.push("portfolio entries empty");
    return { url: null, fieldPath: null, photoId: null, attempts };
  }

  const sorted = [...rows].sort((a, b) => {
    const aCover = asString(a.group_cover) === "1" || asString(a.profile_cover) === "1";
    const bCover = asString(b.group_cover) === "1" || asString(b.profile_cover) === "1";
    if (aCover && !bCover) return -1;
    if (!aCover && bCover) return 1;
    const aOrder = Number(asString(a.order) ?? "99999");
    const bOrder = Number(asString(b.order) ?? "99999");
    if (Number.isFinite(aOrder) && Number.isFinite(bOrder) && aOrder !== bOrder) return aOrder - bOrder;
    return 0;
  });

  for (const [index, row] of sorted.entries()) {
    const candidates: Array<{ path: string; value: string | null }> = [
      { path: "file_main_full_url", value: asString(row.file_main_full_url) },
      { path: "file_thumbnail_full_url", value: asString(row.file_thumbnail_full_url) },
      { path: "file", value: asString(row.file) },
      { path: "original_image_url", value: asString(row.original_image_url) },
    ];

    for (const candidate of candidates) {
      attempts.push(`portfolio[${index}].${candidate.path}=${candidate.value ?? "null"}`);
      const normalized = normalizeBdUrl({ bdBaseUrl: params.bdBaseUrl, value: candidate.value });
      if (normalized) {
        return {
          url: normalized,
          fieldPath: `users_portfolio[*].${candidate.path}`,
          photoId: asString(row.photo_id),
          attempts,
        };
      }
    }
  }

  return { url: null, fieldPath: null, photoId: null, attempts };
}

export async function resolveMainListingImage(input: ResolveMainListingImageInput): Promise<ResolveMainListingImageResult> {
  const attempts: string[] = [];

  // Evidence-based from artifacts/bd/IMAGE_FIELD_REPORT.md (2026-03-01):
  // user/get payload for ids 321, 3, 8 had no usable direct image fields.
  const directUserFieldPaths: string[] = [];

  const payload = unwrapPayload(input.userPayload);

  for (const fieldPath of directUserFieldPaths) {
    const rawValue = asString(readPath(payload, fieldPath));
    attempts.push(`${fieldPath}=${rawValue ?? "null"}`);
    const normalized = normalizeBdUrl({ bdBaseUrl: input.bdBaseUrl, value: rawValue });
    if (normalized) {
      return {
        url: normalized,
        source: `user.${fieldPath}`,
        attempts,
        evidence: { fieldPath },
      };
    }
  }

  const embeddedPortfolio = asArray(readPath(payload, "users_portfolio"));
  const embeddedResult = pickFromPortfolioEntries({
    bdBaseUrl: input.bdBaseUrl,
    entries: embeddedPortfolio,
  });
  attempts.push(...embeddedResult.attempts.map((line) => `embedded.${line}`));
  if (embeddedResult.url) {
    return {
      url: embeddedResult.url,
      source: "payload.users_portfolio",
      attempts,
      evidence: {
        fieldPath: embeddedResult.fieldPath ?? undefined,
        portfolio: {
          photoId: embeddedResult.photoId ?? undefined,
          endpoint: "payload.users_portfolio",
          status: "resolved",
        },
      },
    };
  }

  if (!input.fetchBdJson) {
    attempts.push("fetchBdJson unavailable");
    return {
      url: null,
      source: "missing",
      attempts,
      evidence: {
        fallback: { reason: "No portfolio data in payload and fetchBdJson unavailable" },
      },
    };
  }

  const userId = asString(readPath(payload, "user_id")) ?? asString(readPath(payload, "id"));
  attempts.push(`portfolio.user_id=${userId ?? "null"}`);

  if (!userId) {
    return {
      url: null,
      source: "missing",
      attempts,
      evidence: {
        portfolio: { endpoint: "/api/v2/users_portfolio_groups/search", status: "skipped (missing user_id)" },
      },
    };
  }

  const groupsSearch = await input.fetchBdJson({
    method: "POST",
    path: "/api/v2/users_portfolio_groups/search",
    form: {
      action: "search",
      output_type: "array",
      page: 1,
      limit: 100,
      user_id: userId,
    },
  });

  const groupsRows = firstArray(groupsSearch);
  attempts.push(`portfolio.groups_search.count=${groupsRows.length}`);

  const firstGroup = asObject(groupsRows[0]);
  const groupId = asString(firstGroup?.group_id ?? firstGroup?.id);
  attempts.push(`portfolio.group_id=${groupId ?? "null"}`);

  const getTargets = [groupId, userId].filter((value, index, all) => Boolean(value) && all.indexOf(value) === index) as string[];
  let lastEndpoint = "/api/v2/users_portfolio_groups/search";

  for (const target of getTargets) {
    const endpoint = `/api/v2/users_portfolio_groups/get/${encodeURIComponent(target)}`;
    const groupGet = await input.fetchBdJson({
      method: "GET",
      path: endpoint,
    });
    lastEndpoint = endpoint;
    const groupEntries = extractPortfolioEntriesFromGroupPayload(groupGet);
    attempts.push(`group.get.target=${target}`);
    attempts.push(`group.get.entries=${groupEntries.length}`);
    const groupResult = pickFromPortfolioEntries({ bdBaseUrl: input.bdBaseUrl, entries: groupEntries });
    attempts.push(...groupResult.attempts.map((line) => `group.${line}`));
    if (groupResult.url) {
      return {
        url: groupResult.url,
        source: "portfolio.group",
        attempts,
        evidence: {
          fieldPath: groupResult.fieldPath ?? undefined,
          portfolio: {
            groupId: target,
            photoId: groupResult.photoId ?? undefined,
            endpoint,
            status: "resolved",
          },
        },
      };
    }
  }

  return {
    url: null,
    source: "missing",
    attempts,
    evidence: {
      portfolio: {
        groupId: groupId ?? userId,
        endpoint: lastEndpoint,
        status: "no usable photo fields",
      },
    },
  };
}
