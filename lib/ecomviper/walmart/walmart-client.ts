import "server-only";

import { getWalmartRuntimeMode } from "@/lib/ecomviper/walmart/walmart-mock-data";
import { getWalmartEnvConfig, requestServerSideWalmartToken } from "@/lib/ecomviper/walmart/walmart-auth";

interface WalmartRequestOptions {
  method?: "GET" | "POST" | "PUT";
  path: string;
  body?: unknown;
}

export async function walmartApiRequest<T>(options: WalmartRequestOptions): Promise<{
  ok: boolean;
  mode: "mock" | "dry-run" | "live-ready";
  status: number;
  payload: T;
}> {
  const mode = getWalmartRuntimeMode();
  const envConfig = getWalmartEnvConfig();

  const tokenResult = await requestServerSideWalmartToken();
  if (!tokenResult.ok || !envConfig.configured) {
    return {
      ok: false,
      mode,
      status: 503,
      payload: {
        error: "Walmart auth is not configured.",
      } as T,
    };
  }

  if (mode !== "live-ready") {
    return {
      ok: true,
      mode,
      status: 200,
      payload: {
        dryRun: true,
        note: `Walmart request ${options.method ?? "GET"} ${options.path} captured in ${mode} mode.`,
      } as T,
    };
  }

  // Live-ready seam: outbound Walmart HTTP request integration can be added here.
  return {
    ok: true,
    mode,
    status: 200,
    payload: {
      liveReady: true,
      note: `Live-ready seam reached for ${options.method ?? "GET"} ${options.path}.`,
    } as T,
  };
}
