import {
  ConnectionProfile,
  ThriveNativeExecutionResult,
  ThriveNativeExecutionStepResult,
  ThriveNativeGuardStatus,
  ThriveNativeOperation,
} from "@/lib/siteforge/contracts";
import {
  fingerprintNativePayload,
  getNativeContract,
  THRIVE_NATIVE_CONTRACT_REGISTRY,
  validatePayloadRequiredFields,
  validateResponseShape,
} from "@/lib/siteforge/thriveNativeContracts";
import { nowIso } from "@/lib/siteforge/utils";

export type ThriveExecutionRuntime = {
  wpSafeMode: boolean;
  thriveIntelMode: boolean;
  stagingNativeMode: boolean;
};

function currentEnvironment(): "test" | "development" | "production" {
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.NODE_ENV === "test") return "test";
  return "development";
}

function nativeFeatureEnabled(): boolean {
  return process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING === "1" || process.env.SITEFORGE_ENABLE_THRIVE_NATIVE === "1";
}

function normalizeHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function normalizeApprovedTarget(entry: string): string | null {
  const raw = entry.trim().toLowerCase();
  if (!raw) return null;
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function authHeaders(connection: ConnectionProfile): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (connection.appPassword) {
    const token = Buffer.from(`${connection.username}:${connection.appPassword}`).toString("base64");
    headers.Authorization = `Basic ${token}`;
  }
  return headers;
}

function asOperation(value: string): ThriveNativeOperation | null {
  if (
    value === "assignTemplateToPost" ||
    value === "createOrUpdateSymbol" ||
    value === "createOrUpdateSection" ||
    value === "createOrUpdateTemplateShellReference" ||
    value === "attachReusablePrimitiveToPagePlan" ||
    value === "importArchitectContentArtifact" ||
    value === "importThemeBuilderArtifact"
  ) {
    return value;
  }
  return null;
}

function deriveOperationsFromRoutes(routes: string[]): ThriveNativeOperation[] {
  const operations = new Set<ThriveNativeOperation>();
  const contracts = Object.values(THRIVE_NATIVE_CONTRACT_REGISTRY);
  for (const route of routes) {
    for (const contract of contracts) {
      const normalizedEndpoint = contract.endpoint.replace(/\{[^}]+\}/g, "");
      if (normalizedEndpoint.startsWith("logical:") || normalizedEndpoint.startsWith("artifact:")) continue;
      if (route.includes(normalizedEndpoint)) operations.add(contract.operation);
    }
  }
  return [...operations];
}

export function evaluateThriveNativeGuard(connection: ConnectionProfile): ThriveNativeGuardStatus {
  const environment = currentEnvironment();
  const nativeEnabled = nativeFeatureEnabled();
  const routeAllowlist = (process.env.SITEFORGE_THRIVE_ROUTE_ALLOWLIST ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const approvedTargets = (process.env.SITEFORGE_APPROVED_NATIVE_TARGETS ?? "")
    .split(",")
    .map((entry) => normalizeApprovedTarget(entry))
    .filter((entry): entry is string => Boolean(entry));
  const explicitOperations = (process.env.SITEFORGE_THRIVE_NATIVE_OPERATION_ALLOWLIST ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(asOperation)
    .filter((entry): entry is ThriveNativeOperation => Boolean(entry));

  const derivedFromRoutes = deriveOperationsFromRoutes(routeAllowlist);
  const allowlistedOperations = [...new Set([...explicitOperations, ...derivedFromRoutes])];
  const schemaContractVersion = process.env.SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION ?? null;
  const host = normalizeHost(connection.baseUrl);
  const targetApproved = Boolean(host && approvedTargets.includes(host));
  const targetClassification: ThriveNativeGuardStatus["targetClassification"] = !host
    ? "unknown_target"
    : targetApproved
      ? "approved_non_production_target"
      : "unapproved_target";

  let blockedReason: string | null = null;
  if (!nativeEnabled) blockedReason = "native_flag_disabled";
  else if (!host) blockedReason = "blocked_unapproved_target";
  else if (!targetApproved) blockedReason = "blocked_unapproved_target";
  else if (environment === "production") blockedReason = "production_environment_block";
  else if (!schemaContractVersion) blockedReason = "blocked_schema_contract";
  else if (!allowlistedOperations.length) blockedReason = "blocked_allowlist";
  else {
    for (const operation of allowlistedOperations) {
      const contract = getNativeContract(operation);
      if (!contract) {
        blockedReason = "blocked_missing_contract";
        break;
      }
      if (!contract.verification || !contract.verification.type) {
        blockedReason = "blocked_missing_verification";
        break;
      }
      const requiresRollback =
        operation === "createOrUpdateTemplateShellReference" ||
        operation === "createOrUpdateSection" ||
        operation === "createOrUpdateSymbol";
      if (requiresRollback && (!contract.rollback.supported || !contract.rollback.endpointTemplate)) {
        blockedReason = "blocked_missing_rollback";
        break;
      }
    }
  }

  const eligible = blockedReason == null;
  const nativeTargetMode: ThriveNativeGuardStatus["nativeTargetMode"] = eligible
    ? "approved_non_production_target"
    : targetClassification === "unapproved_target"
      ? "unapproved_target"
      : "blocked";

  return {
    eligible,
    blockedReason,
    environment,
    nativeTargetMode,
    targetClassification,
    nativeTargetEligibility: eligible ? "eligible" : "blocked",
    approvedTargetHost: targetApproved ? host : null,
    approvalSource: targetApproved ? "env_allowlist" : null,
    connectionHost: host,
    allowlistedOperations,
    routeAllowlist,
    schemaContractVersion,
  };
}

function requireGuardForOperation(guard: ThriveNativeGuardStatus, operation: ThriveNativeOperation): void {
  if (!guard.eligible) {
    throw new Error(`Blocked Thrive native operation (${operation}): ${guard.blockedReason ?? "unknown_guard_failure"}`);
  }

  const contract = getNativeContract(operation);
  if (!contract) {
    throw new Error(`Blocked Thrive native operation (${operation}): missing_contract`);
  }

  if (!guard.allowlistedOperations.includes(operation)) {
    throw new Error(`Blocked Thrive native operation (${operation}): operation_not_allowlisted`);
  }

  if (!contract.allowedEnvironments.includes(guard.environment as "test" | "development")) {
    throw new Error(`Blocked Thrive native operation (${operation}): environment_not_allowed`);
  }
}

async function safeJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const parsed = (await response.json()) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function endpointWithPayload(endpoint: string, payload: Record<string, unknown>): string {
  const optionalId = (value: unknown): string => (typeof value === "number" && Number.isFinite(value) ? String(value) : "");
  return endpoint
    .replace("{postId}", String(payload.postId ?? ""))
    .replace("{templateId?}", optionalId(payload.templateId))
    .replace("{symbolId?}", optionalId(payload.symbolId))
    .replace("{sectionId?}", optionalId(payload.sectionId))
    .replace("{templateId?}", optionalId(payload.templateId))
    .replace(/\/\/$/, "/")
    .replace(/\/\{[^}]+\?\}/g, "")
    .replace(/\/+/g, "/")
    .replace(":/", "://");
}

async function verifyReadBack(connection: ConnectionProfile, endpoint: string, expected: string[]): Promise<boolean> {
  const baseUrl = normalizeBaseUrl(connection.baseUrl);
  const res = await fetch(`${baseUrl}${endpoint}${endpoint.includes("?") ? "" : "?context=edit"}`, {
    method: "GET",
    headers: authHeaders(connection),
    cache: "no-store",
  });
  if (!res.ok) return false;
  const record = await safeJson(res);
  return validateResponseShape(record, expected);
}

function readBackEndpointFor(params: {
  operation: ThriveNativeOperation;
  id: number;
  fallbackEndpoint: string;
}): string {
  if (params.operation === "createOrUpdateTemplateShellReference") return `/wp-json/wp/v2/thrive_template/${params.id}`;
  if (params.operation === "createOrUpdateSection") return `/wp-json/wp/v2/thrive_section/${params.id}`;
  if (params.operation === "createOrUpdateSymbol") return `/wp-json/wp/v2/tcb_symbol/${params.id}`;
  return params.fallbackEndpoint.replace(/\/$/, `/${params.id}`);
}

function audit(operation: ThriveNativeOperation, payload: Record<string, unknown>): void {
  console.info(`[siteforge-thrive-native] ${operation}`, payload);
}

export async function executeThriveNativeOperation(params: {
  connection: ConnectionProfile;
  operation: ThriveNativeOperation;
  payload: Record<string, unknown>;
}): Promise<ThriveNativeExecutionStepResult> {
  const guard = evaluateThriveNativeGuard(params.connection);
  requireGuardForOperation(guard, params.operation);

  const contract = getNativeContract(params.operation);
  if (!contract) {
    throw new Error(`Blocked Thrive native operation (${params.operation}): missing_contract`);
  }

  const payloadCheck = validatePayloadRequiredFields(params.payload, contract.requiredPayloadFields);
  if (!payloadCheck.ok) {
    throw new Error(`Blocked Thrive native operation (${params.operation}): missing_payload_fields:${payloadCheck.missing.join("|")}`);
  }

  const payloadHash = fingerprintNativePayload(params.payload);
  const endpoint = endpointWithPayload(contract.endpoint, params.payload);
  audit(params.operation, { endpoint, payloadHash, objectType: contract.objectType });

  if (endpoint.startsWith("logical:")) {
    return {
      operation: params.operation,
      objectType: contract.objectType,
      targetId: typeof params.payload.primitiveId === "number" ? params.payload.primitiveId : null,
      endpoint,
      method: contract.method,
      payloadHash,
      success: true,
      verificationPassed: true,
      rollbackReady: false,
      detail: "logical_attachment_recorded",
      responseStatus: 200,
    };
  }

  if (endpoint.startsWith("artifact:")) {
    return {
      operation: params.operation,
      objectType: contract.objectType,
      targetId: null,
      endpoint,
      method: contract.method,
      payloadHash,
      success: true,
      verificationPassed: true,
      rollbackReady: false,
      detail: "artifact_placeholder_accepted",
      responseStatus: 202,
    };
  }

  const baseUrl = normalizeBaseUrl(params.connection.baseUrl);
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: contract.method,
    headers: authHeaders(params.connection),
    body: JSON.stringify(params.payload),
    cache: "no-store",
  });

  const record = await safeJson(res);
  const id = typeof record?.id === "number" ? record.id : null;

  let verificationPassed = false;
  if (res.ok) {
    if (contract.verification.type === "logical") {
      verificationPassed = true;
    } else if (contract.verification.type === "response_fields") {
      verificationPassed = validateResponseShape(record, contract.expectedResponseFields);
    } else if (contract.verification.type === "read_back") {
      if (!id) verificationPassed = false;
      else {
        verificationPassed = await verifyReadBack(
          params.connection,
          readBackEndpointFor({
            operation: params.operation,
            id,
            fallbackEndpoint: endpoint,
          }),
          contract.verification.expected
        );
      }
    }
  }

  return {
    operation: params.operation,
    objectType: contract.objectType,
    targetId: id,
    endpoint,
    method: contract.method,
    payloadHash,
    success: res.ok,
    verificationPassed,
    rollbackReady: Boolean(contract.rollback.supported && id),
    detail: res.ok ? (verificationPassed ? "verified" : "verification_failed") : "request_failed",
    responseStatus: res.status,
  };
}

export async function executeThriveNativePlan(params: {
  connection: ConnectionProfile;
  mode: "thrive_native_staging_mode" | "blocked_native_mode";
  operations: Array<{
    operation: ThriveNativeOperation;
    payload: Record<string, unknown>;
  }>;
}): Promise<ThriveNativeExecutionResult> {
  const guard = evaluateThriveNativeGuard(params.connection);
  if (!guard.eligible) {
    return {
      executedAt: nowIso(),
      success: false,
      mode: "blocked_native_mode",
      steps: [],
      createdObjects: [],
      rollback: { available: false, steps: [] },
      warnings: [`native_guard_blocked:${guard.blockedReason ?? "unknown"}`],
    };
  }

  const steps: ThriveNativeExecutionStepResult[] = [];
  const createdObjects: ThriveNativeExecutionResult["createdObjects"] = [];
  let lastTemplateId: number | null = null;

  for (const operation of params.operations) {
    const payload = { ...operation.payload };
    if (operation.operation === "assignTemplateToPost" && (payload.templateId == null || payload.templateId === 0) && lastTemplateId) {
      payload.templateId = lastTemplateId;
      payload.meta = { ...(payload.meta as Record<string, unknown> | undefined), thrive_template_id: lastTemplateId };
    }
    const step = await executeThriveNativeOperation({
      connection: params.connection,
      operation: operation.operation,
      payload,
    });
    steps.push(step);

    if (
      step.success &&
      step.verificationPassed &&
      step.targetId &&
      (step.objectType === "thrive_template" || step.objectType === "thrive_section" || step.objectType === "tcb_symbol")
    ) {
      createdObjects.push({
        objectType: step.objectType,
        id: step.targetId,
        sourceOperation: step.operation,
      });
      if (step.objectType === "thrive_template") lastTemplateId = step.targetId;
    }
  }

  return {
    executedAt: nowIso(),
    success: steps.every((step) => step.success && step.verificationPassed),
    mode: params.mode,
    steps,
    createdObjects,
    rollback: {
      available: createdObjects.length > 0,
      steps: createdObjects.map((entry) => ({
        objectType: entry.objectType,
        id: entry.id,
        operation: "DELETE",
        attempted: false,
        success: false,
        detail: "not_attempted",
      })),
    },
    warnings: steps.filter((step) => !step.verificationPassed).map((step) => `verification_failed:${step.operation}`),
  };
}

export async function rollbackThriveNativeExecution(params: {
  connection: ConnectionProfile;
  execution: ThriveNativeExecutionResult;
}): Promise<ThriveNativeExecutionResult["rollback"]> {
  const guard = evaluateThriveNativeGuard(params.connection);
  if (!guard.eligible) {
    return {
      available: false,
      steps: params.execution.createdObjects.map((entry) => ({
        objectType: entry.objectType,
        id: entry.id,
        operation: "DELETE",
        attempted: false,
        success: false,
        detail: `guard_blocked:${guard.blockedReason ?? "unknown"}`,
      })),
    };
  }

  const baseUrl = normalizeBaseUrl(params.connection.baseUrl);
  const headers = authHeaders(params.connection);

  const rollbackSteps: ThriveNativeExecutionResult["rollback"]["steps"] = [];

  for (const item of params.execution.createdObjects) {
    const rollbackTemplate = getNativeContract(item.sourceOperation)?.rollback.endpointTemplate;
    if (!rollbackTemplate) {
      rollbackSteps.push({
        objectType: item.objectType,
        id: item.id,
        operation: "DELETE",
        attempted: false,
        success: false,
        detail: "rollback_not_supported",
      });
      continue;
    }

    const endpoint = rollbackTemplate.replace("{id}", String(item.id));
    const deleteUrl = `${baseUrl}${endpoint}${endpoint.includes("?") ? "&force=true" : "?force=true"}`;
    const res = await fetch(deleteUrl, {
      method: "DELETE",
      headers,
      cache: "no-store",
    });

    rollbackSteps.push({
      objectType: item.objectType,
      id: item.id,
      operation: "DELETE",
      attempted: true,
      success: res.ok,
      detail: res.ok ? "deleted" : `delete_failed:${res.status}`,
    });
  }

  return {
    available: rollbackSteps.length > 0,
    steps: rollbackSteps,
  };
}

export function getThriveExecutionRuntime(params: { thriveIntelligenceAvailable: boolean }): ThriveExecutionRuntime {
  const stagingNativeMode = nativeFeatureEnabled() && currentEnvironment() !== "production";

  return {
    wpSafeMode: true,
    thriveIntelMode: params.thriveIntelligenceAvailable,
    stagingNativeMode,
  };
}

export async function assignTemplateToPost(params: {
  connection: ConnectionProfile;
  postId: number;
  templateId: number;
}): Promise<ThriveNativeExecutionStepResult> {
  return executeThriveNativeOperation({
    connection: params.connection,
    operation: "assignTemplateToPost",
    payload: { postId: params.postId, meta: { thrive_template_id: params.templateId }, templateId: params.templateId },
  });
}

export async function createOrUpdateThriveSymbol(params: {
  connection: ConnectionProfile;
  symbolId?: number;
  title: string;
  slug?: string;
}): Promise<ThriveNativeExecutionStepResult> {
  return executeThriveNativeOperation({
    connection: params.connection,
    operation: "createOrUpdateSymbol",
    payload: {
      symbolId: params.symbolId,
      title: params.title,
      slug: params.slug ?? params.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      status: "publish",
    },
  });
}

export async function createOrUpdateThriveSection(params: {
  connection: ConnectionProfile;
  sectionId?: number;
  name: string;
  slug?: string;
}): Promise<ThriveNativeExecutionStepResult> {
  return executeThriveNativeOperation({
    connection: params.connection,
    operation: "createOrUpdateSection",
    payload: {
      sectionId: params.sectionId,
      title: params.name,
      slug: params.slug ?? params.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      status: "publish",
    },
  });
}

export async function importArchitectContentArtifact(params: {
  connection: ConnectionProfile;
  artifactRef: string;
}): Promise<ThriveNativeExecutionStepResult> {
  return executeThriveNativeOperation({
    connection: params.connection,
    operation: "importArchitectContentArtifact",
    payload: { artifactRef: params.artifactRef, accepted: true },
  });
}

export async function importThemeBuilderArtifact(params: {
  connection: ConnectionProfile;
  artifactRef: string;
}): Promise<ThriveNativeExecutionStepResult> {
  return executeThriveNativeOperation({
    connection: params.connection,
    operation: "importThemeBuilderArtifact",
    payload: { artifactRef: params.artifactRef, accepted: true },
  });
}
