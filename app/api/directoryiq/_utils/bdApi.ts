export async function bdGet(): Promise<any> {
  return { ok: true };
}

export async function bdPost(): Promise<any> {
  return { ok: true };
}

export async function bdPut(): Promise<any> {
  return { ok: true };
}

type BdResponse = {
  ok: boolean;
  status: number;
  json: Record<string, unknown> | null;
  text?: string;
};

export function normalizeBdBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "");
}

export async function bdRequestForm(input: {
  baseUrl: string;
  apiKey: string;
  method?: string;
  path: string;
  form?: Record<string, unknown>;
}): Promise<BdResponse> {
  try {
    const method = (input.method ?? "POST").toUpperCase();
    const headers: Record<string, string> = {
      "X-Api-Key": input.apiKey,
      Accept: "application/json",
    };
    if (method !== "GET") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(input.form ?? {})) {
      if (value == null) continue;
      body.set(key, String(value));
    }

    const response = await fetch(`${normalizeBdBaseUrl(input.baseUrl)}${input.path}`, {
      method,
      headers,
      body: method === "GET" ? undefined : body,
      cache: "no-store",
    });

    const text = await response.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = null;
    }
    return { ok: response.ok, status: response.status, json, text };
  } catch (error) {
    const message = error instanceof Error ? error.message : "bd request failed";
    return { ok: false, status: 500, json: { error: message }, text: message };
  }
}

export async function bdRequestWithRetry(
  request: () => Promise<BdResponse>,
  maxAttempts = 2
): Promise<BdResponse> {
  let last: BdResponse | null = null;
  for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
    const result = await request();
    if (result.ok || result.status < 500) return result;
    last = result;
  }
  return last ?? { ok: false, status: 500, json: { error: "request failed" } };
}

export function parseBdTotals(json: Record<string, unknown>): {
  status: string | null;
  total: number | null;
  totalPages: number | null;
  page: number | null;
  limit: number | null;
} {
  const asNum = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  return {
    status: typeof json.status === "string" ? json.status : null,
    total: asNum(json.total ?? json.total_records ?? json.records_total),
    totalPages: asNum(json.total_pages ?? json.pages ?? json.last_page),
    page: asNum(json.page ?? json.current_page),
    limit: asNum(json.limit ?? json.per_page),
  };
}

export function parseBdRecords(json: Record<string, unknown>): Record<string, unknown>[] {
  const data = json.data;
  if (Array.isArray(data)) return data.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
  if (data && typeof data === "object") {
    const typed = data as Record<string, unknown>;
    const list = typed.records ?? typed.items ?? typed.rows;
    if (Array.isArray(list)) {
      return list.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
    }
  }
  const records = json.records ?? json.items ?? json.rows;
  if (Array.isArray(records)) {
    return records.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
  }
  return [];
}
