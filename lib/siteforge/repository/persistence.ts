import { SiteForgeStorageSummary } from "@/lib/siteforge/repository/types";

export type SiteForgeRuntimeEnv = "test" | "development" | "production";

export type SiteForgeStoragePolicy = {
  runtimeEnv: SiteForgeRuntimeEnv;
  fallbackAllowed: boolean;
  fallbackFlag: boolean;
};

export type SiteForgePostgresAvailability = {
  available: boolean;
  reason: string | null;
  reasonCode: "ok" | "missing_tables" | "db_unreachable" | "db_misconfigured";
};

export const SITEFORGE_PERSISTENCE_UNAVAILABLE_CODE = "SITEFORGE_PERSISTENCE_UNAVAILABLE";
export const SITEFORGE_PERSISTENCE_UNAVAILABLE_MESSAGE =
  "Persistent SiteForge storage is unavailable in production. SiteForge is disabled until database storage is restored.";

function isTruthyFlag(value: string | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function getSiteForgeStoragePolicy(): SiteForgeStoragePolicy {
  const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  const appEnv = (process.env.APP_ENV ?? "").trim().toLowerCase();
  const fallbackFlag = isTruthyFlag(process.env.SITEFORGE_ALLOW_MEMORY_FALLBACK);

  const runtimeEnv: SiteForgeRuntimeEnv =
    nodeEnv === "test"
      ? "test"
      : nodeEnv === "production" || appEnv === "production"
        ? "production"
        : "development";

  const fallbackAllowed = runtimeEnv === "test" || (runtimeEnv === "development" && fallbackFlag);
  return { runtimeEnv, fallbackAllowed, fallbackFlag };
}

export function buildStorageSummary(params: {
  mode: "postgres" | "memory";
  availability: SiteForgePostgresAvailability;
  policy: SiteForgeStoragePolicy;
}): SiteForgeStorageSummary {
  const { mode, availability, policy } = params;
  if (mode === "postgres") {
    return {
      storageMode: "postgres",
      persistenceHealth: "healthy",
      fallbackAllowed: policy.fallbackAllowed,
      fallbackActive: false,
      reason: null,
    };
  }

  return {
    storageMode: "memory",
    persistenceHealth: "degraded",
    fallbackAllowed: policy.fallbackAllowed,
    fallbackActive: true,
    reason:
      `Using non-durable memory fallback (${availability.reasonCode}) in ${policy.runtimeEnv} environment.` +
      " Projects and runs are not persistent across restarts.",
  };
}

export class SiteForgePersistenceError extends Error {
  readonly code = SITEFORGE_PERSISTENCE_UNAVAILABLE_CODE;
  readonly status = 503;
  readonly storage: SiteForgeStorageSummary & {
    postgresAvailable: boolean;
    postgresReasonCode: SiteForgePostgresAvailability["reasonCode"];
    postgresReason: string | null;
    runtimeEnv: SiteForgeRuntimeEnv;
  };

  constructor(params: {
    message?: string;
    availability: SiteForgePostgresAvailability;
    policy: SiteForgeStoragePolicy;
  }) {
    super(params.message ?? SITEFORGE_PERSISTENCE_UNAVAILABLE_MESSAGE);
    this.name = "SiteForgePersistenceError";
    this.storage = {
      ...buildStorageSummary({
        mode: "postgres",
        availability: params.availability,
        policy: params.policy,
      }),
      persistenceHealth: "unavailable",
      reason: params.availability.reason ?? "Persistent storage is unavailable.",
      postgresAvailable: params.availability.available,
      postgresReasonCode: params.availability.reasonCode,
      postgresReason: params.availability.reason,
      runtimeEnv: params.policy.runtimeEnv,
    };
  }
}

export function isSiteForgePersistenceError(error: unknown): error is SiteForgePersistenceError {
  if (error instanceof SiteForgePersistenceError) return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; status?: unknown; message?: unknown; storage?: unknown };
  return (
    candidate.code === SITEFORGE_PERSISTENCE_UNAVAILABLE_CODE &&
    candidate.status === 503 &&
    typeof candidate.message === "string" &&
    Boolean(candidate.storage && typeof candidate.storage === "object")
  );
}
