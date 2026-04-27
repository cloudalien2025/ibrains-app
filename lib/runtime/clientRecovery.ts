const CLIENT_RECOVERY_STORAGE_PREFIX = "ibrains:stale-client-reload:";

const RECOVERABLE_ERROR_PATTERNS = [
  "chunkloaderror",
  "loading chunk",
  "failed to fetch dynamically imported module",
  "importing a module script failed",
  "failed to fetch server response",
  "failed to fetch rsc payload",
  "unable to load script",
];

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function cleanValue(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function extractMessage(input: unknown, depth = 0): string | null {
  if (depth > 2 || input == null) {
    return null;
  }

  if (typeof input === "string") {
    return cleanValue(input);
  }

  if (input instanceof Error) {
    return cleanValue(input.message) || extractMessage(input.cause, depth + 1);
  }

  if (typeof input === "object") {
    const value = input as {
      message?: unknown;
      reason?: unknown;
      error?: unknown;
      cause?: unknown;
    };

    return (
      extractMessage(value.message, depth + 1) ||
      extractMessage(value.reason, depth + 1) ||
      extractMessage(value.error, depth + 1) ||
      extractMessage(value.cause, depth + 1)
    );
  }

  return null;
}

export function getClientRuntimeErrorMessage(input: unknown) {
  return extractMessage(input);
}

export function isRecoverableClientRuntimeError(input: unknown) {
  const message = extractMessage(input);
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return RECOVERABLE_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function buildClientRecoveryStorageKey(releaseId?: string | null) {
  return `${CLIENT_RECOVERY_STORAGE_PREFIX}${cleanValue(releaseId) || "unknown"}`;
}

export function getCurrentDocumentReleaseId() {
  if (typeof document === "undefined") {
    return null;
  }

  return cleanValue(document.body?.dataset?.releaseId);
}

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function attemptRecoverFromClientRuntimeError(
  input: unknown,
  options: {
    releaseId?: string | null;
    storage?: StorageLike | null;
    onReload?: (() => void) | null;
  } = {}
) {
  if (!isRecoverableClientRuntimeError(input)) {
    return false;
  }

  const storage = options.storage ?? getBrowserStorage();
  if (!storage) {
    return false;
  }

  const releaseId = options.releaseId ?? getCurrentDocumentReleaseId();
  const storageKey = buildClientRecoveryStorageKey(releaseId);
  if (storage.getItem(storageKey) === "1") {
    return false;
  }

  storage.setItem(storageKey, "1");

  if (options.onReload) {
    options.onReload();
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  window.location.reload();
  return true;
}
