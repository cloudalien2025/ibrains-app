export type BdRequest = {
  baseUrl: string;
  path: string;
  apiKey: string;
  method?: "GET" | "POST" | "PUT";
  form?: Record<string, unknown>;
};

export type BdResponse = {
  ok: boolean;
  status: number;
  json: Record<string, unknown> | null;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export async function requestBd(input: BdRequest): Promise<BdResponse> {
  const method = input.method ?? "POST";
  const headers: Record<string, string> = {
    "X-Api-Key": input.apiKey,
  };

  let body: string | undefined;
  if (method !== "GET") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(input.form ?? {})) {
      if (value == null) continue;
      form.set(key, String(value));
    }
    body = form.toString();
  }

  const res = await fetch(`${normalizeBaseUrl(input.baseUrl)}${input.path}`, {
    method,
    headers,
    body,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: res.ok, status: res.status, json };
}
