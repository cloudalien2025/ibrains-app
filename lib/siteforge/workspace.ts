import {
  BuildSession,
  CapabilityCheckResult,
  ConnectionProfile,
  HomepageStrategyMode,
  SiteForgeConnection,
  SiteForgeSnapshot,
  StoredAiSecret,
} from "@/lib/siteforge/contracts";
import { normalizeOpenAiModel } from "@/lib/siteforge/ai";
import { SiteForgeRepository } from "@/lib/siteforge/repository/types";
import { decryptSecret, encryptSecret } from "@/lib/siteforge/secrets";
import { createId, nowIso } from "@/lib/siteforge/utils";

export async function resolveRuntimeConnection(params: {
  repo: SiteForgeRepository;
  projectId: string;
  incoming: ConnectionProfile | null;
  preferConnectionId?: string;
}): Promise<{ connection: ConnectionProfile | null; connectionId: string | null; secretFromSaved: boolean }> {
  if (params.incoming?.baseUrl && params.incoming.username && params.incoming.appPassword) {
    return {
      connection: params.incoming,
      connectionId: params.preferConnectionId ?? params.incoming.id,
      secretFromSaved: false,
    };
  }

  const saved = await params.repo.getProjectConnection(params.projectId);
  if (!saved) {
    return {
      connection: params.incoming,
      connectionId: null,
      secretFromSaved: false,
    };
  }

  const secret = await params.repo.getConnectionSecret(saved.connectionId);
  if (!secret) {
    return {
      connection: {
        id: saved.connectionId,
        label: saved.label,
        baseUrl: saved.wordpressUrl,
        username: saved.username,
        hasThriveHint: saved.thriveDetected,
        lastValidatedAt: saved.lastValidatedAt,
      },
      connectionId: saved.connectionId,
      secretFromSaved: false,
    };
  }

  return {
    connection: {
      id: saved.connectionId,
      label: saved.label,
      baseUrl: saved.wordpressUrl,
      username: saved.username,
      appPassword: decryptSecret(secret.cipherText),
      hasThriveHint: saved.thriveDetected,
      lastValidatedAt: saved.lastValidatedAt,
    },
    connectionId: saved.connectionId,
    secretFromSaved: true,
  };
}

export async function saveConnectionProfile(params: {
  repo: SiteForgeRepository;
  projectId: string;
  connection: ConnectionProfile;
  validation: CapabilityCheckResult;
}): Promise<SiteForgeConnection> {
  const encrypted = params.connection.appPassword ? encryptSecret(params.connection.appPassword) : null;
  const now = nowIso();

  return params.repo.upsertConnection({
    projectId: params.projectId,
    connection: {
      connectionId: params.connection.id,
      projectId: params.projectId,
      label: params.connection.label,
      wordpressUrl: params.connection.baseUrl,
      username: params.connection.username,
      authType: "application_password",
      secretRef: encrypted?.ref ?? null,
      hasSavedSecret: Boolean(encrypted),
      thriveDetected: params.validation.thriveDetected,
      writeAccess: params.validation.canWritePages,
      lastValidatedAt: now,
      lastValidationStatus: params.validation.connected ? "valid" : "invalid",
      createdAt: now,
      updatedAt: now,
    },
    secret: encrypted,
  });
}

export async function persistSnapshotFromSession(params: {
  repo: SiteForgeRepository;
  session: BuildSession;
  homepageStrategy: HomepageStrategyMode;
  connectionId: string | null;
  thriveDetected: boolean;
}): Promise<SiteForgeSnapshot> {
  const execution = params.session.executionResult;
  const homepageSlug = params.session.buildSpec?.homepageSlug;
  const homepageSpecPage = params.session.buildSpec?.pages.find((page) => page.slug === homepageSlug) ?? null;
  const homepageRecord =
    execution?.createdPages.find((page) => page.intent === "homepage") ??
    (homepageSlug ? execution?.createdPages.find((page) => page.slug === homepageSlug) : undefined) ??
    null;
  const discoveryPages = execution?.discovery?.pages ?? [];

  const knownPagesByIdOrSlug = new Map<string, SiteForgeSnapshot["knownPages"][number]>();

  for (const page of discoveryPages) {
    const key = page.id != null ? `id:${page.id}` : `slug:${page.slug}`;
    knownPagesByIdOrSlug.set(key, {
      id: page.id,
      slug: page.slug,
      title: page.title,
      url: page.url,
      status: page.status,
      source: "existing",
    });
  }

  for (const page of execution?.createdPages ?? []) {
    const key = page.pageId != null ? `id:${page.pageId}` : `slug:${page.slug}`;
    knownPagesByIdOrSlug.set(key, {
      id: page.pageId,
      slug: page.slug,
      title: page.title,
      url: page.url,
      status: page.status,
      intent: page.intent,
      source: page.decision === "reused_existing" ? "reused" : "created",
      decision: page.decision,
    });
  }

  const knownPages = Array.from(knownPagesByIdOrSlug.values());

  const canonicalHomepageId =
    execution?.homepage?.pageId ??
    homepageRecord?.pageId ??
    execution?.discovery?.frontPageId ??
    null;

  const canonicalHomepageTitle =
    execution?.homepage?.title ??
    homepageRecord?.title ??
    execution?.discovery?.frontPageTitle ??
    homepageSpecPage?.title ??
    null;

  const canonicalHomepageSource =
    homepageRecord?.decision === "reused_existing" ||
    (execution?.homepage?.reason && execution.homepage.reason.startsWith("use_existing"))
      ? "wordpress"
      : params.thriveDetected
        ? "thrive"
        : "wordpress";

  const snapshot: SiteForgeSnapshot = {
    snapshotId: createId("sfsnap"),
    projectId: params.session.projectId,
    connectionId: params.connectionId,
    currentHomepageId: canonicalHomepageId,
    currentHomepageTitle: canonicalHomepageTitle,
    currentHomepageSource: canonicalHomepageSource,
    knownPages,
    knownMenus: execution?.menu?.menuId
      ? [{ id: execution.menu.menuId, label: "Primary Navigation", source: "wordpress" }]
      : [],
    thriveDetected: params.thriveDetected,
    thriveIntelligence: execution?.thrive?.intelligence ?? null,
    homepageStrategy: params.homepageStrategy,
    lastRunSummary: execution
      ? `Pages applied: ${execution.createdPages.filter((entry) => entry.status === "created" || entry.status === "updated").length}`
      : `Build completed (${params.session.runState.currentStage})`,
    lastRunStatus: params.session.status,
    pagesAffected: knownPages.length,
    lastSyncedAt: nowIso(),
  };

  return params.repo.upsertSnapshot(snapshot);
}

export async function saveProjectAiConfig(params: {
  repo: SiteForgeRepository;
  projectId: string;
  model: string;
  apiKey?: string;
}): Promise<void> {
  const encrypted = params.apiKey?.trim() ? encryptSecret(params.apiKey.trim()) : null;
  await params.repo.saveProjectAiConfig({
    projectId: params.projectId,
    provider: "openai",
    model: normalizeOpenAiModel(params.model),
    secret: encrypted as StoredAiSecret | null,
  });
}

export async function clearProjectAiConfig(params: {
  repo: SiteForgeRepository;
  projectId: string;
  model: string;
}): Promise<void> {
  await params.repo.saveProjectAiConfig({
    projectId: params.projectId,
    provider: "openai",
    model: normalizeOpenAiModel(params.model),
    secret: null,
  });
  await params.repo.clearProjectAiSecret(params.projectId);
}

export async function resolveProjectAiApiKey(params: {
  repo: SiteForgeRepository;
  projectId: string;
}): Promise<string | null> {
  const secret = await params.repo.getProjectAiSecret(params.projectId);
  if (!secret) return null;
  return decryptSecret(secret.cipherText);
}
