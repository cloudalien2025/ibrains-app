import { bdRequestForm, bdRequestWithRetry, parseBdRecords } from "@/app/api/directoryiq/_utils/bdApi";
import { extractBdListingRows, hasBdListingLikeRows } from "@/app/api/directoryiq/_utils/listingResponse";

type DetectionStatus = "verified" | "verified_empty" | "invalid" | "unresolved";

export type BdPostTypeRole =
  | "primary_listing"
  | "article_or_blog"
  | "video"
  | "property"
  | "coupon"
  | "event"
  | "product"
  | "discussion"
  | "review"
  | "photo_album"
  | "other_structured_content"
  | "unknown";

export type BdEndpointFamily = "users_portfolio_groups" | "data_posts";

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
  discovery: BdPostTypeDiscoveryResult;
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
  permalink: string | null;
  raw: Record<string, unknown>;
  source: DetectionSource;
};

type EndpointProbe = {
  family: BdEndpointFamily;
  path: string;
  ok: boolean;
  accepted: boolean;
  statusCode: number | null;
  count: number;
  sampleRows: Record<string, unknown>[];
};

export type BdDiscoveredPostType = {
  dataId: number;
  name: string;
  permalink: string | null;
  rawMetadata: Record<string, unknown>;
  canonicalValid: boolean;
  canonicalDataType: string | null;
  canonicalStatusCode: number | null;
  endpointFamily: BdEndpointFamily | null;
  searchPath: string | null;
  sampleCount: number;
  role: BdPostTypeRole;
  confidence: number;
  autoEnabled: boolean;
  evidence: string[];
  probes: EndpointProbe[];
};

export type BdPostTypeDiscoveryResult = {
  inventory: BdDiscoveredPostType[];
  selected: {
    primaryListingDataId: number | null;
    primaryListingPath: string | null;
    articleOrBlogDataId: number | null;
    articleOrBlogPath: string | null;
  };
  optional: Array<{
    dataId: number;
    role: BdPostTypeRole;
    confidence: number;
    name: string;
  }>;
  compatibility: {
    listingsDataId: number | null;
    listingsPath: string | null;
    blogPostsDataId: number | null;
    blogPostsPath: string | null;
  };
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

type CategoryValidityEvidence = {
  exists: boolean;
  dataType: string | null;
  statusCode: number | null;
  indeterminate: boolean;
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
  function resolveFromUnknown(candidate: unknown): string | null {
    if (!candidate) return null;
    if (Array.isArray(candidate)) {
      for (const row of candidate) {
        const found = resolveFromUnknown(row);
        if (found) return found;
      }
      return null;
    }
    if (typeof candidate !== "object") return null;
    const typed = candidate as Record<string, unknown>;
    const direct = asString(typed.data_type);
    if (direct) return direct;
    for (const value of Object.values(typed)) {
      const found = resolveFromUnknown(value);
      if (found) return found;
    }
    return null;
  }

  return resolveFromUnknown(payload);
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

function extractCategoryId(candidate: Record<string, unknown>): number | null {
  return asNumber(candidate.data_id ?? candidate.id ?? candidate.category_id ?? candidate.post_type_id);
}

function findCategoryRecord(candidate: unknown, targetDataId: number): Record<string, unknown> | null {
  if (!candidate) return null;
  if (Array.isArray(candidate)) {
    for (const row of candidate) {
      const found = findCategoryRecord(row, targetDataId);
      if (found) return found;
    }
    return null;
  }
  if (typeof candidate !== "object") return null;

  const typed = candidate as Record<string, unknown>;
  const dataId = extractCategoryId(typed);
  if (dataId === targetDataId) return typed;

  for (const value of Object.values(typed)) {
    const found = findCategoryRecord(value, targetDataId);
    if (found) return found;
  }
  return null;
}

function resolveCategoryValidityEvidence(payload: Record<string, unknown> | null, targetDataId: number): {
  exists: boolean;
  dataType: string | null;
  indeterminate: boolean;
} {
  if (!payload || !isSuccessWrapper(payload)) {
    return { exists: false, dataType: null, indeterminate: false };
  }

  const exact = findCategoryRecord(payload, targetDataId);
  if (exact) {
    return { exists: true, dataType: parseDataType(exact), indeterminate: false };
  }

  const genericType = parseDataType(payload);
  if (genericType) {
    return { exists: true, dataType: genericType, indeterminate: false };
  }

  return { exists: false, dataType: null, indeterminate: true };
}

async function fetchCategoryValidity(params: {
  baseUrl: string;
  apiKey: string;
  dataId: number;
}): Promise<CategoryValidityEvidence> {
  const response = await bdRequestWithRetry(() =>
    bdRequestForm({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      method: "GET",
      path: `/api/v2/data_categories/get/${encodeURIComponent(String(params.dataId))}`,
    })
  );

  const payload = (response.json ?? null) as Record<string, unknown> | null;
  const evidence = resolveCategoryValidityEvidence(payload, params.dataId);

  if (response.ok && evidence.exists) {
    return {
      exists: true,
      dataType: evidence.dataType,
      statusCode: response.status,
      indeterminate: false,
    };
  }
  if (response.status === 404) {
    return {
      exists: false,
      dataType: null,
      statusCode: response.status,
      indeterminate: false,
    };
  }

  return {
    exists: false,
    dataType: evidence.dataType,
    statusCode: response.status,
    indeterminate: evidence.indeterminate,
  };
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
  const canonical = await fetchCategoryValidity({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    dataId: params.dataId,
  });
  const preflightType = canonical.dataType;
  if (!canonical.exists) {
    return {
      status: canonical.indeterminate ? "unresolved" : "invalid",
      reason: canonical.indeterminate ? "listings_data_category_indeterminate" : "listings_data_id_not_found",
      ok: false,
      accepted: false,
      statusCode: canonical.statusCode,
      count: 0,
      path: params.listingsPath,
      dataTypeObserved: preflightType,
    };
  }
  if (preflightType && preflightType !== "4") {
    return {
      status: "invalid",
      reason: "listings_data_id_invalid_type",
      ok: false,
      accepted: false,
      statusCode: canonical.statusCode,
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
  if (searchAccepted) {
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
      status: "verified_empty",
      reason: "listings_valid_path_invalid",
      ok: true,
      accepted: false,
      statusCode: search.status,
      count: rows.length,
      path: params.listingsPath,
      dataTypeObserved: preflightType,
    };
  }

  return {
    status: "verified_empty",
    reason: "listings_valid_search_unconfirmed",
    ok: true,
    accepted: false,
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
  const canonical = await fetchCategoryValidity({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    dataId: params.dataId,
  });
  const preflightType = canonical.dataType;
  if (!canonical.exists) {
    return {
      status: canonical.indeterminate ? "unresolved" : "invalid",
      reason: canonical.indeterminate ? "blog_posts_data_category_indeterminate" : "blog_posts_data_id_not_found",
      ok: false,
      accepted: false,
      statusCode: canonical.statusCode,
      count: 0,
      path: params.blogPaths[0] ?? null,
      dataTypeObserved: preflightType,
    };
  }
  if (preflightType === "4") {
    return {
      status: "invalid",
      reason: "blog_posts_data_id_invalid_type",
      ok: false,
      accepted: false,
      statusCode: canonical.statusCode,
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
    if (preflightType && preflightType !== "4") {
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
      status: "verified_empty",
      reason: "blog_posts_valid_path_invalid",
      ok: true,
      accepted: false,
      statusCode: 404,
      count: 0,
      path: invalidPathValue,
      dataTypeObserved: preflightType,
    };
  }

  return {
    status: "verified_empty",
    reason: "blog_posts_valid_search_unconfirmed",
    ok: true,
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
  const activeGet = await bdRequestWithRetry(() =>
    bdRequestForm({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      method: "GET",
      path: "/api/v2/data_categories/get?property=data_active&property_value=1",
    })
  );
  const activePayload = (activeGet.json ?? null) as Record<string, unknown> | null;
  if (activeGet.ok && activePayload && isSuccessWrapper(activePayload)) {
    const records = parseRecordsWithFallback(activePayload);
    const rows: CategoryCandidate[] = [];
    for (const record of records) {
      const dataId = asNumber(record.data_id ?? record.id ?? record.category_id ?? record.post_type_id);
      if (!dataId) continue;
      rows.push({
        dataId,
        dataType: asString(record.data_type) || null,
        title: asString(record.name ?? record.title ?? record.data_name ?? record.label),
        permalink: asString(record.permalink ?? record.slug ?? record.route ?? record.path) || null,
        raw: record,
        source: "data_categories_search",
      });
    }
    if (rows.length > 0) {
      return {
        path: "/api/v2/data_categories/get?property=data_active&property_value=1",
        statusCode: activeGet.status,
        rows,
      };
    }
  }

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
        permalink: asString(record.permalink ?? record.slug ?? record.route ?? record.path) || null,
        raw: record,
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

function roundConfidence(value: number): number {
  const bounded = Math.max(0, Math.min(1, value));
  return Math.round(bounded * 100) / 100;
}

function classifyDiscoveredPostType(input: {
  name: string;
  permalink: string | null;
  canonicalDataType: string | null;
  probes: EndpointProbe[];
}): { role: BdPostTypeRole; confidence: number; evidence: string[] } {
  const text = `${input.name} ${input.permalink ?? ""}`.toLowerCase();
  const scores: Record<BdPostTypeRole, number> = {
    primary_listing: 0,
    article_or_blog: 0,
    video: 0,
    property: 0,
    coupon: 0,
    event: 0,
    product: 0,
    discussion: 0,
    review: 0,
    photo_album: 0,
    other_structured_content: 0,
    unknown: 0,
  };
  const evidence: string[] = [];
  const add = (role: BdPostTypeRole, value: number, note: string) => {
    scores[role] += value;
    evidence.push(note);
  };

  if (input.canonicalDataType === "4") add("primary_listing", 70, "canonical data_type=4");

  const usersProbe = input.probes.find((probe) => probe.family === "users_portfolio_groups");
  const dataPostsProbe = input.probes.find((probe) => probe.family === "data_posts");
  if (usersProbe?.accepted) add("primary_listing", 25, "users_portfolio_groups/search accepted");
  if (dataPostsProbe?.accepted) add("article_or_blog", 15, "data_posts/search accepted");
  if ((usersProbe?.count ?? 0) > 0) add("primary_listing", 10, "users_portfolio_groups returned rows");
  if ((dataPostsProbe?.count ?? 0) > 0) add("article_or_blog", 10, "data_posts returned rows");

  if (/\b(listing|business listing|member listing|directory|company)\b/.test(text)) {
    add("primary_listing", 35, "name/permalink indicates listing");
  }
  if (/\b(blog|article|news|post)\b/.test(text)) add("article_or_blog", 40, "name/permalink indicates article/blog");
  if (/\b(video|videos)\b/.test(text)) add("video", 45, "name/permalink indicates video");
  if (/\b(property|properties|real estate)\b/.test(text)) add("property", 45, "name/permalink indicates property");
  if (/\b(coupon|coupons|deal|deals)\b/.test(text)) add("coupon", 45, "name/permalink indicates coupon");
  if (/\b(event|events|calendar)\b/.test(text)) add("event", 40, "name/permalink indicates event");
  if (/\b(product|products|shop|store)\b/.test(text)) add("product", 40, "name/permalink indicates product");
  if (/\b(discussion|forum|thread|threads)\b/.test(text)) add("discussion", 40, "name/permalink indicates discussion");
  if (/\b(review|reviews|testimonial|testimonials)\b/.test(text)) add("review", 40, "name/permalink indicates review");
  if (/\b(photo|photos|album|albums|gallery|galleries)\b/.test(text)) {
    add("photo_album", 40, "name/permalink indicates photo album");
  }

  let bestRole: BdPostTypeRole = "unknown";
  let bestScore = 0;
  for (const [role, score] of Object.entries(scores) as Array<[BdPostTypeRole, number]>) {
    if (role === "unknown") continue;
    if (score > bestScore) {
      bestScore = score;
      bestRole = role;
    }
  }

  if (bestScore < 25) {
    const acceptedProbe = input.probes.find((probe) => probe.accepted);
    if (acceptedProbe) {
      return {
        role: "other_structured_content",
        confidence: roundConfidence(0.35),
        evidence: [...evidence, `${acceptedProbe.family} accepted with weak keyword evidence`],
      };
    }
    return { role: "unknown", confidence: 0.2, evidence: evidence.length > 0 ? evidence : ["insufficient evidence"] };
  }

  return {
    role: bestRole,
    confidence: roundConfidence(bestScore / 100),
    evidence,
  };
}

async function probeEndpoint(input: {
  baseUrl: string;
  apiKey: string;
  dataId: number;
  family: BdEndpointFamily;
  path: string;
}): Promise<EndpointProbe> {
  const response = await bdRequestWithRetry(() =>
    bdRequestForm({
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      method: "POST",
      path: input.path,
      form: {
        action: "search",
        output_type: "array",
        data_id: input.dataId,
        limit: 5,
        page: 1,
      },
    })
  );
  const payload = (response.json ?? null) as Record<string, unknown> | null;
  const rows = extractBdListingRows(payload ?? {});
  return {
    family: input.family,
    path: input.path,
    ok: response.ok,
    accepted: response.ok && isSuccessWrapper(payload),
    statusCode: response.status,
    count: rows.length,
    sampleRows: rows.slice(0, 2),
  };
}

function selectBestProbe(probes: EndpointProbe[]): EndpointProbe | null {
  const accepted = probes.filter((probe) => probe.accepted);
  if (accepted.length === 0) return null;
  accepted.sort((a, b) => b.count - a.count);
  return accepted[0] ?? null;
}

async function discoverBdPostTypes(input: {
  baseUrl: string;
  apiKey: string;
  listingsPath: string;
  blogPaths: string[];
  categoryRows: CategoryCandidate[];
  listingHintIds: number[];
  blogHintIds: number[];
  configuredListingsDataId: number | null;
  configuredBlogPostsDataId: number | null;
}): Promise<BdPostTypeDiscoveryResult> {
  const categoriesById = new Map<number, CategoryCandidate>();
  for (const row of input.categoryRows) {
    categoriesById.set(row.dataId, row);
  }
  const candidateIds = makeUniqueCandidates([
    ...(input.configuredListingsDataId ? [{ dataId: input.configuredListingsDataId, source: "configured" as const }] : []),
    ...(input.configuredBlogPostsDataId ? [{ dataId: input.configuredBlogPostsDataId, source: "configured" as const }] : []),
    ...input.categoryRows.map((row) => ({ dataId: row.dataId, source: row.source })),
    ...input.listingHintIds.map((dataId) => ({ dataId, source: "listings_payload_hint" as const })),
    ...input.blogHintIds.map((dataId) => ({ dataId, source: "blog_payload_hint" as const })),
    { dataId: 75, source: "default_probe" as const },
    { dataId: 14, source: "default_probe" as const },
  ])
    .map((item) => item.dataId)
    .slice(0, 30);

  const usersPath =
    input.listingsPath.includes("/users_portfolio_groups/") ? input.listingsPath : "/api/v2/users_portfolio_groups/search";
  const dataPostsPath = input.blogPaths[0] ?? "/api/v2/data_posts/search";

  const inventory: BdDiscoveredPostType[] = [];
  for (const dataId of candidateIds) {
    const canonical = await fetchCategoryValidity({
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      dataId,
    });
    if (!canonical.exists && !canonical.indeterminate) continue;

    const category = categoriesById.get(dataId);
    const name = category?.title || `Post Type ${dataId}`;
    const permalink = category?.permalink ?? null;
    const rawMetadata = category?.raw ?? {};
    const probes = await Promise.all([
      probeEndpoint({
        baseUrl: input.baseUrl,
        apiKey: input.apiKey,
        dataId,
        family: "users_portfolio_groups",
        path: usersPath,
      }),
      probeEndpoint({
        baseUrl: input.baseUrl,
        apiKey: input.apiKey,
        dataId,
        family: "data_posts",
        path: dataPostsPath,
      }),
    ]);
    const selectedProbe = selectBestProbe(probes);
    const classification = classifyDiscoveredPostType({
      name,
      permalink,
      canonicalDataType: canonical.dataType,
      probes,
    });
    inventory.push({
      dataId,
      name,
      permalink,
      rawMetadata,
      canonicalValid: canonical.exists,
      canonicalDataType: canonical.dataType,
      canonicalStatusCode: canonical.statusCode,
      endpointFamily: selectedProbe?.family ?? null,
      searchPath: selectedProbe?.path ?? null,
      sampleCount: selectedProbe?.count ?? 0,
      role: classification.role,
      confidence: classification.confidence,
      autoEnabled: false,
      evidence: classification.evidence,
      probes,
    });
  }

  const byScore = (role: BdPostTypeRole) =>
    inventory
      .filter((item) => item.canonicalValid && item.role === role)
      .sort((a, b) => b.confidence - a.confidence || b.sampleCount - a.sampleCount);

  const listingPick = byScore("primary_listing")[0] ?? null;
  const blogPick = byScore("article_or_blog").find((item) => item.dataId !== listingPick?.dataId) ?? null;

  for (const item of inventory) {
    if (item.dataId === listingPick?.dataId || item.dataId === blogPick?.dataId) {
      item.autoEnabled = true;
    }
  }

  const optional = inventory
    .filter((item) => !item.autoEnabled)
    .map((item) => ({
      dataId: item.dataId,
      role: item.role,
      confidence: item.confidence,
      name: item.name,
    }));

  return {
    inventory,
    selected: {
      primaryListingDataId: listingPick?.dataId ?? null,
      primaryListingPath: listingPick?.searchPath ?? usersPath,
      articleOrBlogDataId: blogPick?.dataId ?? null,
      articleOrBlogPath: blogPick?.searchPath ?? dataPostsPath,
    },
    optional,
    compatibility: {
      listingsDataId: listingPick?.dataId ?? null,
      listingsPath: listingPick?.searchPath ?? usersPath,
      blogPostsDataId: blogPick?.dataId ?? null,
      blogPostsPath: blogPick?.searchPath ?? dataPostsPath,
    },
  };
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
  const discovery = await discoverBdPostTypes({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    listingsPath,
    blogPaths,
    categoryRows: categoryDiscovery.rows,
    listingHintIds,
    blogHintIds,
    configuredListingsDataId: input.configuredListingsDataId,
    configuredBlogPostsDataId: input.configuredBlogPostsDataId,
  });

  const listingCandidates = makeUniqueCandidates([
    ...(input.configuredListingsDataId ? [{ dataId: input.configuredListingsDataId, source: "configured" as const }] : []),
    ...(typeof discovery.selected.primaryListingDataId === "number"
      ? [{ dataId: discovery.selected.primaryListingDataId, source: "data_categories_search" as const }]
      : []),
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
    ...(typeof discovery.selected.articleOrBlogDataId === "number"
      ? [{ dataId: discovery.selected.articleOrBlogDataId, source: "data_categories_search" as const }]
      : []),
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
    discovery,
    diagnostics: {
      categoryCandidatesCount: categoryDiscovery.rows.length,
      categorySearchPath: categoryDiscovery.path,
      categorySearchStatus: categoryDiscovery.statusCode,
      notes: diagnosticsNotes,
    },
  };
}
