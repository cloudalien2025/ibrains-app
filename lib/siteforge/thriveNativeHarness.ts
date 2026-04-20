import { ConnectionProfile } from "@/lib/siteforge/contracts";

export type ThriveNativeOperation =
  | "assignTemplateToPost"
  | "createOrUpdateThriveSymbol"
  | "createOrUpdateThriveSection"
  | "importArchitectContentArtifact"
  | "importThemeBuilderArtifact";

export type ThriveNativeGuardContext = {
  environment: "test" | "development" | "production";
  enableNativeStaging: boolean;
  stagingMarker: string | null;
  routeAllowlist: string[];
  schemaContractVersion: string | null;
  connection: ConnectionProfile;
};

export type ThriveExecutionRuntime = {
  wpSafeMode: boolean;
  thriveIntelMode: boolean;
  stagingNativeMode: boolean;
};

const ALLOWED_STAGING_MARKER = "staging";

function currentEnvironment(): "test" | "development" | "production" {
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.NODE_ENV === "test") return "test";
  return "development";
}

function normalizeHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function assertStagingGuard(context: ThriveNativeGuardContext, operation: ThriveNativeOperation): void {
  if (!context.enableNativeStaging) {
    throw new Error(`Thrive native staging mode disabled: ${operation}`);
  }
  if (context.environment === "production") {
    throw new Error(`Blocked Thrive native operation in production: ${operation}`);
  }
  if ((context.stagingMarker ?? "").toLowerCase() !== ALLOWED_STAGING_MARKER) {
    throw new Error(`Missing staging marker for Thrive native operation: ${operation}`);
  }
  if (!context.schemaContractVersion) {
    throw new Error(`Missing schema contract for Thrive native operation: ${operation}`);
  }
  if (!context.routeAllowlist.length) {
    throw new Error(`Missing route allowlist for Thrive native operation: ${operation}`);
  }

  const host = normalizeHost(context.connection.baseUrl);
  if (!host || host.includes("ipetzo") || host.includes("www.ipetzo")) {
    throw new Error(`Blocked live-site Thrive native operation: ${operation}`);
  }
}

function audit(operation: ThriveNativeOperation, payload: Record<string, unknown>): void {
  // Single-line audit record for future staging-native observability.
  console.info(`[siteforge-thrive-native] ${operation}`, payload);
}

export function getThriveExecutionRuntime(params: { thriveIntelligenceAvailable: boolean }): ThriveExecutionRuntime {
  const nativeEnabled = process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING === "1";
  const marker = (process.env.SITEFORGE_THRIVE_STAGING_MARKER ?? "").toLowerCase();
  const stagingNativeMode = nativeEnabled && marker === ALLOWED_STAGING_MARKER && currentEnvironment() !== "production";

  return {
    wpSafeMode: true,
    thriveIntelMode: params.thriveIntelligenceAvailable,
    stagingNativeMode,
  };
}

function guardContext(connection: ConnectionProfile): ThriveNativeGuardContext {
  return {
    environment: currentEnvironment(),
    enableNativeStaging: process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING === "1",
    stagingMarker: process.env.SITEFORGE_THRIVE_STAGING_MARKER ?? null,
    routeAllowlist: (process.env.SITEFORGE_THRIVE_ROUTE_ALLOWLIST ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
    schemaContractVersion: process.env.SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION ?? null,
    connection,
  };
}

export async function assignTemplateToPost(params: {
  connection: ConnectionProfile;
  postId: number;
  templateId: number;
}): Promise<{ ok: false; mode: "staging_only_stub" }> {
  const context = guardContext(params.connection);
  assertStagingGuard(context, "assignTemplateToPost");
  audit("assignTemplateToPost", { postId: params.postId, templateId: params.templateId });
  return { ok: false, mode: "staging_only_stub" };
}

export async function createOrUpdateThriveSymbol(params: {
  connection: ConnectionProfile;
  symbolId?: number;
  title: string;
}): Promise<{ ok: false; mode: "staging_only_stub" }> {
  const context = guardContext(params.connection);
  assertStagingGuard(context, "createOrUpdateThriveSymbol");
  audit("createOrUpdateThriveSymbol", { symbolId: params.symbolId ?? null, title: params.title });
  return { ok: false, mode: "staging_only_stub" };
}

export async function createOrUpdateThriveSection(params: {
  connection: ConnectionProfile;
  sectionId?: number;
  name: string;
}): Promise<{ ok: false; mode: "staging_only_stub" }> {
  const context = guardContext(params.connection);
  assertStagingGuard(context, "createOrUpdateThriveSection");
  audit("createOrUpdateThriveSection", { sectionId: params.sectionId ?? null, name: params.name });
  return { ok: false, mode: "staging_only_stub" };
}

export async function importArchitectContentArtifact(params: {
  connection: ConnectionProfile;
  artifactRef: string;
}): Promise<{ ok: false; mode: "staging_only_stub" }> {
  const context = guardContext(params.connection);
  assertStagingGuard(context, "importArchitectContentArtifact");
  audit("importArchitectContentArtifact", { artifactRef: params.artifactRef });
  return { ok: false, mode: "staging_only_stub" };
}

export async function importThemeBuilderArtifact(params: {
  connection: ConnectionProfile;
  artifactRef: string;
}): Promise<{ ok: false; mode: "staging_only_stub" }> {
  const context = guardContext(params.connection);
  assertStagingGuard(context, "importThemeBuilderArtifact");
  audit("importThemeBuilderArtifact", { artifactRef: params.artifactRef });
  return { ok: false, mode: "staging_only_stub" };
}
