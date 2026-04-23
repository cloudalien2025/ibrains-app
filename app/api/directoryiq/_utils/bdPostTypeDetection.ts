import { bdRequestForm, bdRequestWithRetry, parseBdRecords } from "@/app/api/directoryiq/_utils/bdApi";
import { extractBdListingRows, hasBdListingLikeRows } from "@/app/api/directoryiq/_utils/listingResponse";

type DetectionStatus = "verified" | "verified_empty" | "invalid" | "unresolved";

type DetectionSource =
  | "configured"
  | "data_categories_search"
  | "listings_payload_hint"
  | "blog_payload_hint"
  | "default_probe";

type DetectionAttempt = {
  dataId: number;
  source: DetectionSource;
  ok: boolean;
  statusCode: number | null;
  count: number;
  path: string | null;
  dataTypeObserved: string | null;
};

export type BdPostTypeDetectionBranch = {
  configuredDataId: number | null;
  effectiveDataId: number | null;
  autoDetected: boolean;
  status: DetectionStatus;
  reason: string | null;
  detectedFrom: DetectionSource | null;
  dataTypeObserved: string | null;
  search: {
    ok: boolean;
    status: number | null;
    count: number;
    path: string | null;
    triedPaths: string[];
  };
  attempts: DetectionAttempt[];
};

export type BdPostTypeDetectionResult = {
  listings: BdPostTypeDetectionBranch;
  blogPosts: BdPostTypeDetectionBranch;
  diagnostics: {
    categoryCandidatesCount: number;
    categorySearchPath: string | null;
    categorySearchStatus: number | null;
    notes: string[];
  };
};

export type BdPostTypeDetectionInput = {
  baseUrl: string;
  apiKey: string;
  listingsPath: string;
  blogPostsPath: string | null;
  configuredListingsDataId: number | null;
  configuredBlogPostsDataId: number | null;
};

type CategoryCandidate = {
  dataId: number;
  dataType: string | null;
  title: string;
  source: DetectionSource;
};

type VerifyResult = {
  status: DetectionStatus;
  reason: string | null;
  ok: boolean;
  accepted: boolean;
  statusCode: number | null;
  count: number;
  path: string | null;
  dataTypeObserved: string | null;
};

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (!Number.isInteger(parsed)) return null;
  return parsed > 0 ? parsed : null;
}

function normalizePath(path: string | null | undefined): string {
  const trimmed = asString(path);
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function isSuccessWrapper(payload: Record<string, unknown> | null): boolean {
  const status = typeof payload?.status === "string" ? payload.status.toLowerCase() : null;
  return !status || status === "success";
}

function parseRecordsWithFallback(payload: Record<string, unknown>): Record<string, unknown>[] {
  const parsed = parseBdRecords(payload);
  if (parsed.length > 0) return parsed;
  const rows = extractBdListingRows(payload);
  if (rows.length > 0) return rows;
  const message = payload.message;
  if (Array.isArray(message)) {
    return message.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  }
  return [];
}

function parseDataType(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const direct = asString(payload.data_type);
  if (direct) return direct;
  const message = payload.message;
  if (message && typeof message === "object" && !Array.isArray(message)) {
    const nested = message as Record<string, unknown>;
    const nestedType = asString(nested.data_type);
    if (nestedType) return nestedType;
  }
  const data = payload.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const nested = data as Record<string, unknown>;
    const nestedType = asString(nested.data_type);
    if (nestedType) return nestedType;
  }
  return null;
}

function isListingCategoryTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return /\b(listing|business|company|member|directory)\b/.test(lower);
}

function isBlogCategoryTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return /\b(blog|article|post|news)\b/.test(lower);
}

function collectDataPostsSearchPaths(preferredPath: string | null): string[] {
  const candidates = [
    preferredPath,
    "/api/v2/data_posts/search",
    "/api/v2/data_post/search",
    "/api/v2/posts/search",
    "/api/v2/data_posts/list",
  ];
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = normalizePath(candidate);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    paths.push(normalized);
  }
  return paths;
}

function canonicalPostId(row: Record<string, unknown>): string {
  const postId = asString(row.post_id);
  if (postId) return postId;
  return "";
}

function hasBlogLikeRow(rows: Record<string, unknown>[]): boolean {
  return rows.some((row) => {
    const postId = canonicalPostId(row);
    if (!postId) return false;
    const hasTitle = Boolean(asString(row.post_title) || asString(row.title) || asString(row.name));
    const hasLocator = Boolean(
      asString(row.post_filename) ||
        asString(row.slug) ||
        asString(row.url) ||
        asString(row.link) ||
        asString(row.permalink)
    );
    return hasTitle || hasLocator;
  });
}

function extractIdHints(rows: Record<string, unknown>[]): number[] {
  const ids = new Set<number>();
  for (const row of rows) {
    const possible = [row.data_id, row.category_id, row.post_type_id, row.group_type_id];
    for (const value of possible) {
      const id = asNumber(value);
      if (id) ids.add(id);
    }
  }
  return Array.from(ids.values());
}

function makeUniqueCandidates(items: Array<{ dataId: number; source: DetectionSource }>): Array<{ dataId: number; source: DetectionSource }> {
  const seen = new Set<number>();
  const out: Array<{ dataId: number; source: DetectionSource }> = [];
  for (const item of items) {
    if (seen.has(item.dataId)) continue;
    seen.add(item.dataId);
    out.push(item);
  }
  return out.slice(0, 15);
}

async function verifyListingsCandidate(params: {
  baseUrl: string;
  apiKey: string;
  listingsPath: string;
  dataId: number;
}): Promise<VerifyResult> {
  const preflight = await bdRequestWithRetry(() =>
    bdRequestForm({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      method: "GET",
      path: `/api/v2/data_categories/get/${encodeURIComponent(String(params.dataId))}`,
    })
  );
  const preflightPayload = (preflight.json ?? null) as Record<string, unknown> | null;
  const preflightType = parseDataType(preflightPayload);
  const preflightAccepted = preflight.ok && isSuccessWrapper(preflightPayload);
  if (preflight.ok && preflightType && preflightType !== "4") {
    return {
      status: "invalid",
      reason: "listings_data_id_invalid_type",
      ok: false,
      accepted: false,
      statusCode: preflight.status,
      count: 0,
      path: params.listingsPath,
      dataTypeObserved: preflightType,
    };
  }

  const search = await bdRequestWithRetry(() =>
    bdRequestForm({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      method: "POST",
      path: params.listingsPath,
      form: {
        action: "search",
        output_type: "array",
        data_id: params.dataId,
        limit: 5,
        page: 1,
      },
    })
  );
  const payload = (search.json ?? null) as Record<string, unknown> | null;
  const rows = extractBdListingRows(payload ?? {});
  const searchAccepted = search.ok && isSuccessWrapper(payload);
  const listingRows = hasBdListingLikeRows(rows);
  const acceptedViaTypedPreflight = preflightAccepted && preflightType === "4";
  if (searchAccepted && listingRows) {
    return {
      status: "verified",
      reason: null,
      ok: true,
      accepted: true,
      statusCode: search.status,
      count: rows.length,
      path: params.listingsPath,
      dataTypeObserved: preflightType,
    };
  }
  if (searchAccepted && acceptedViaTypedPreflight) {
    return {
      status: "verified_empty",
      reason: "listings_verified_empty",
      ok: true,
      accepted: true,
      statusCode: search.status,
      count: rows.length,
      path: params.listingsPath,
      dataTypeObserved: preflightType,
    };
  }
  if (!searchAccepted && search.status === 404) {
    return {
      status: "invalid",
      reason: "listings_path_not_found",
      ok: false,
      accepted: false,
      statusCode: search.status,
      count: rows.length,
      path: params.listingsPath,
      dataTypeObserved: preflightType,
    };
  }

  return {
    status: "unresolved",
    reason: "listings_data_id_unverified",
    ok: false,
    accepted: searchAccepted,
    statusCode: search.status,
    count: rows.length,
    path: params.listingsPath,
    dataTypeObserved: preflightType,
  };
}

async function verifyBlogCandidate(params: {
  baseUrl: string;
  apiKey: string;
  blogPaths: string[];
  dataId: number;
}): Promise<VerifyResult> {
  const preflight = await bdRequestWithRetry(() =>
    bdRequestForm({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      method: "GET",
      path: `/api/v2/data_categories/get/${encodeURIComponent(String(params.dataId))}`,
    })
  );
  const preflightPayload = (preflight.json ?? null) as Record<string, unknown> | null;
  const preflightType = parseDataType(preflightPayload);
  const preflightAccepted = preflight.ok && isSuccessWrapper(preflightPayload);
  if (preflightAccepted && preflightType === "4") {
    return {
      status: "invalid",
      reason: "blog_posts_data_id_invalid_type",
      ok: false,
      accepted: false,
      statusCode: preflight.status,
      count: 0,
      path: params.blogPaths[0] ?? null,
      dataTypeObserved: preflightType,
    };
  }

  let sawAcceptedPath = false;
  let lastStatusCode: number | null = null;
  let lastCount = 0;
  let invalidPath = false;
  let invalidPathValue: string | null = null;

  for (const path of params.blogPaths) {
    const search = await bdRequestWithRetry(() =>
      bdRequestForm({
        baseUrl: params.baseUrl,
        apiKey: params.apiKey,
        method: "POST",
        path,
        form: {
          action: "search",
          output_type: "array",
          data_id: params.dataId,
          limit: 5,
          page: 1,
        },
      })
    );
    const payload = (search.json ?? null) as Record<string, unknown> | null;
    const rows = extractBdListingRows(payload ?? {});
    lastStatusCode = search.status;
    lastCount = rows.length;
    const searchAccepted = search.ok && isSuccessWrapper(payload);
    if (search.status === 404) {
      invalidPath = true;
      invalidPathValue = path;
      continue;
    }
    if (!searchAccepted) continue;

    sawAcceptedPath = true;
    const looksLikeBlog = hasBlogLikeRow(rows) && !hasBdListingLikeRows(rows);
    if (looksLikeBlog) {
      return {
        status: "verified",
        reason: null,
        ok: true,
        accepted: true,
        statusCode: search.status,
        count: rows.length,
        path,
        dataTypeObserved: preflightType,
      };
    }
    if (preflightAccepted && preflightType && preflightType !== "4") {
      return {
        status: "verified_empty",
        reason: "blog_posts_verified_empty",
        ok: true,
        accepted: true,
        statusCode: search.status,
        count: rows.length,
        path,
        dataTypeObserved: preflightType,
      };
    }
  }

  if (invalidPath && !sawAcceptedPath) {
    return {
      status: "invalid",
      reason: "blog_posts_path_not_found",
      ok: false,
      accepted: false,
      statusCode: 404,
      count: 0,
      path: invalidPathValue,
      dataTypeObserved: preflightType,
    };
  }

  return {
    status: "unresolved",
    reason: "blog_posts_data_id_unverified",
    ok: false,
    accepted: sawAcceptedPath,
    statusCode: lastStatusCode,
    count: lastCount,
    path: params.blogPaths[0] ?? null,
    dataTypeObserved: preflightType,
  };
}

async function discoverCategories(params: { baseUrl: string; apiKey: string }): Promise<{
  path: string | null;
  statusCode: number | null;
  rows: CategoryCandidate[];
}> {
  const paths = [
    "/api/v2/data_categories/search",
    "/api/v2/data_category/search",
    "/api/v2/data_categories/list",
    "/api/v2/data_category/list",
  ];

  for (const path of paths) {
    const response = await bdRequestWithRetry(() =>
      bdRequestForm({
        baseUrl: params.baseUrl,
        apiKey: params.apiKey,
        method: "POST",
        path,
        form: {
          action: "search",
          output_type: "array",
          page: 1,
          limit: 250,
        },
      })
    );
    const payload = (response.json ?? null) as Record<string, unknown> | null;
    if (!response.ok || !payload || !isSuccessWrapper(payload)) {
      continue;
    }
    const records = parseRecordsWithFallback(payload);
    const rows: CategoryCandidate[] = [];
    for (const record of records) {
      const dataId = asNumber(record.data_id ?? record.id ?? record.category_id ?? record.post_type_id);
      if (!dataId) continue;
      rows.push({
        dataId,
        dataType: asString(record.data_type) || null,
        title: asString(record.name ?? record.title ?? record.data_name ?? record.label),
        source: "data_categories_search",
      });
    }
    if (rows.length > 0) {
      return {
        path,
        statusCode: response.status,
        rows,
      };
    }
  }

  return { path: null, statusCode: null, rows: [] };
}

async function discoverHintIdsFromSearch(params: {
  baseUrl: string;
  apiKey: string;
  listingsPath: string;
  blogPaths: string[];
}): Promise<{ listingHintIds: number[]; blogHintIds: number[] }> {
  const listingHintIds: number[] = [];
  const listingsResponse = await bdRequestWithRetry(() =>
    bdRequestForm({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      method: "POST",
      path: params.listingsPath,
      form: {
        action: "search",
        output_type: "array",
        limit: 5,
        page: 1,
      },
    })
  );
  const listingsPayload = (listingsResponse.json ?? null) as Record<string, unknown> | null;
  if (listingsResponse.ok && isSuccessWrapper(listingsPayload)) {
    listingHintIds.push(...extractIdHints(extractBdListingRows(listingsPayload ?? {})));
  }

  const blogHintIds: number[] = [];
  for (const path of params.blogPaths) {
    const response = await bdRequestWithRetry(() =>
      bdRequestForm({
        baseUrl: params.baseUrl,
        apiKey: params.apiKey,
        method: "POST",
        path,
        form: {
          action: "search",
          output_type: "array",
          limit: 5,
          page: 1,
        },
      })
    );
    const payload = (response.json ?? null) as Record<string, unknown> | null;
    if (!response.ok || !isSuccessWrapper(payload)) continue;
    blogHintIds.push(...extractIdHints(extractBdListingRows(payload ?? {})));
  }

  return { listingHintIds, blogHintIds };
}

export async function detectBdPostTypeIds(input: BdPostTypeDetectionInput): Promise<BdPostTypeDetectionResult> {
  const listingsPath = normalizePath(input.listingsPath || "/api/v2/users_portfolio_groups/search");
  const blogPaths = collectDataPostsSearchPaths(input.blogPostsPath);
  const diagnosticsNotes: string[] = [];

  const categoryDiscovery = await discoverCategories({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
  });
  if (!categoryDiscovery.path) {
    diagnosticsNotes.push("data_categories enumeration endpoint did not yield records");
  }

  const { listingHintIds, blogHintIds } = await discoverHintIdsFromSearch({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    listingsPath,
    blogPaths,
  });

  const listingCandidates = makeUniqueCandidates([
    ...(input.configuredListingsDataId ? [{ dataId: input.configuredListingsDataId, source: "configured" as const }] : []),
    ...categoryDiscovery.rows
      .filter((row) => row.dataType === "4" || isListingCategoryTitle(row.title))
      .map((row) => ({ dataId: row.dataId, source: row.source })),
    ...listingHintIds.map((dataId) => ({ dataId, source: "listings_payload_hint" as const })),
    { dataId: 75, source: "default_probe" as const },
  ]);

  const listingAttempts: DetectionAttempt[] = [];
  let listingsBranch: BdPostTypeDetectionBranch = {
    configuredDataId: input.configuredListingsDataId,
    effectiveDataId: null,
    autoDetected: false,
    status: "unresolved",
    reason: input.configuredListingsDataId ? "listings_data_id_unverified" : "listings_data_id_missing",
    detectedFrom: null,
    dataTypeObserved: null,
    search: { ok: false, status: null, count: 0, path: listingsPath, triedPaths: [listingsPath] },
    attempts: listingAttempts,
  };

  for (const candidate of listingCandidates) {
    const verified = await verifyListingsCandidate({
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      listingsPath,
      dataId: candidate.dataId,
    });
    listingAttempts.push({
      dataId: candidate.dataId,
      source: candidate.source,
      ok: verified.ok,
      statusCode: verified.statusCode,
      count: verified.count,
      path: verified.path,
      dataTypeObserved: verified.dataTypeObserved,
    });
    if (!verified.ok) {
      if (candidate.source === "configured" && verified.status === "invalid") {
        listingsBranch = {
          ...listingsBranch,
          status: "invalid",
          reason: verified.reason,
          dataTypeObserved: verified.dataTypeObserved,
          search: {
            ok: verified.accepted,
            status: verified.statusCode,
            count: verified.count,
            path: verified.path,
            triedPaths: [listingsPath],
          },
        };
      }
      continue;
    }
    const configuredMatches = input.configuredListingsDataId === candidate.dataId;
    listingsBranch = {
      configuredDataId: input.configuredListingsDataId,
      effectiveDataId: candidate.dataId,
      autoDetected: !configuredMatches,
      status: verified.status,
      reason: verified.reason,
      detectedFrom: candidate.source,
      dataTypeObserved: verified.dataTypeObserved,
      search: {
        ok: verified.accepted,
        status: verified.statusCode,
        count: verified.count,
        path: listingsPath,
        triedPaths: [listingsPath],
      },
      attempts: listingAttempts,
    };
    break;
  }

  const blogCandidates = makeUniqueCandidates([
    ...(input.configuredBlogPostsDataId ? [{ dataId: input.configuredBlogPostsDataId, source: "configured" as const }] : []),
    ...categoryDiscovery.rows
      .filter((row) => isBlogCategoryTitle(row.title) && row.dataType !== "4")
      .map((row) => ({ dataId: row.dataId, source: row.source })),
    ...blogHintIds.map((dataId) => ({ dataId, source: "blog_payload_hint" as const })),
    { dataId: 14, source: "default_probe" as const },
  ]);

  const blogAttempts: DetectionAttempt[] = [];
  let blogBranch: BdPostTypeDetectionBranch = {
    configuredDataId: input.configuredBlogPostsDataId,
    effectiveDataId: null,
    autoDetected: false,
    status: "unresolved",
    reason: input.configuredBlogPostsDataId ? "blog_posts_data_id_unverified" : "blog_posts_data_id_missing",
    detectedFrom: null,
    dataTypeObserved: null,
    search: {
      ok: false,
      status: null,
      count: 0,
      path: blogPaths[0] ?? null,
      triedPaths: blogPaths,
    },
    attempts: blogAttempts,
  };

  for (const candidate of blogCandidates) {
    const verified = await verifyBlogCandidate({
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      blogPaths,
      dataId: candidate.dataId,
    });
    blogAttempts.push({
      dataId: candidate.dataId,
      source: candidate.source,
      ok: verified.ok,
      statusCode: verified.statusCode,
      count: verified.count,
      path: verified.path,
      dataTypeObserved: verified.dataTypeObserved,
    });
    if (!verified.ok) {
      if (candidate.source === "configured" && verified.status === "invalid") {
        blogBranch = {
          ...blogBranch,
          status: "invalid",
          reason: verified.reason,
          dataTypeObserved: verified.dataTypeObserved,
          search: {
            ok: verified.accepted,
            status: verified.statusCode,
            count: verified.count,
            path: verified.path,
            triedPaths: blogPaths,
          },
        };
      }
      continue;
    }
    const configuredMatches = input.configuredBlogPostsDataId === candidate.dataId;
    blogBranch = {
      configuredDataId: input.configuredBlogPostsDataId,
      effectiveDataId: candidate.dataId,
      autoDetected: !configuredMatches,
      status: verified.status,
      reason: verified.reason,
      detectedFrom: candidate.source,
      dataTypeObserved: verified.dataTypeObserved,
      search: {
        ok: verified.accepted,
        status: verified.statusCode,
        count: verified.count,
        path: verified.path,
        triedPaths: blogPaths,
      },
      attempts: blogAttempts,
    };
    break;
  }

  return {
    listings: listingsBranch,
    blogPosts: blogBranch,
    diagnostics: {
      categoryCandidatesCount: categoryDiscovery.rows.length,
      categorySearchPath: categoryDiscovery.path,
      categorySearchStatus: categoryDiscovery.statusCode,
      notes: diagnosticsNotes,
    },
  };
}
