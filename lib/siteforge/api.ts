import { ConnectionProfile, homepageStrategyModes, HomepageStrategyMode } from "@/lib/siteforge/contracts";
import { createId, nowIso } from "@/lib/siteforge/utils";

export type BuildRequestPayload = {
  projectName?: string;
  projectDescription?: string;
  prompt: string;
  connectionId?: string;
  homepageStrategy?: HomepageStrategyMode;
  connection?: {
    label?: string;
    baseUrl?: string;
    username?: string;
    appPassword?: string;
    hasThriveHint?: boolean;
  };
};

export function sanitizeConnection(connection: ConnectionProfile | null): Omit<ConnectionProfile, "appPassword"> | null {
  if (!connection) return null;
  return {
    id: connection.id,
    label: connection.label,
    baseUrl: connection.baseUrl,
    username: connection.username,
    hasThriveHint: connection.hasThriveHint,
    lastValidatedAt: connection.lastValidatedAt ?? null,
  };
}

export function resolveConnection(payload: BuildRequestPayload): ConnectionProfile | null {
  const baseUrl = payload.connection?.baseUrl?.trim();
  const username = payload.connection?.username?.trim();
  const appPassword = payload.connection?.appPassword?.trim();

  if (!baseUrl || !username || !appPassword) {
    return null;
  }

  return {
    id: createId("conn"),
    label: payload.connection?.label?.trim() || "WordPress",
    baseUrl,
    username,
    appPassword,
    hasThriveHint: payload.connection?.hasThriveHint === true,
    lastValidatedAt: nowIso(),
  };
}

export function parseBuildPayload(body: unknown): BuildRequestPayload {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Body must be a JSON object.");
  }

  const record = body as Record<string, unknown>;
  const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
  if (!prompt) {
    throw new Error("Prompt is required.");
  }

  const connectionRaw =
    record.connection && typeof record.connection === "object" && !Array.isArray(record.connection)
      ? (record.connection as Record<string, unknown>)
      : undefined;

  return {
    projectName: typeof record.projectName === "string" ? record.projectName.trim() : undefined,
    projectDescription: typeof record.projectDescription === "string" ? record.projectDescription.trim() : undefined,
    prompt,
    connectionId: typeof record.connectionId === "string" && record.connectionId.trim() ? record.connectionId.trim() : undefined,
    homepageStrategy:
      typeof record.homepageStrategy === "string" &&
      (homepageStrategyModes as readonly string[]).includes(record.homepageStrategy)
        ? (record.homepageStrategy as HomepageStrategyMode)
        : undefined,
    connection: connectionRaw
      ? {
          label: typeof connectionRaw.label === "string" ? connectionRaw.label : undefined,
          baseUrl: typeof connectionRaw.baseUrl === "string" ? connectionRaw.baseUrl : undefined,
          username: typeof connectionRaw.username === "string" ? connectionRaw.username : undefined,
          appPassword: typeof connectionRaw.appPassword === "string" ? connectionRaw.appPassword : undefined,
          hasThriveHint: connectionRaw.hasThriveHint === true,
        }
      : undefined,
  };
}
