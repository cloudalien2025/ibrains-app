import { describe, expect, it, vi } from "vitest";
import {
  attemptRecoverFromClientRuntimeError,
  buildClientRecoveryStorageKey,
  getClientRuntimeErrorMessage,
  isRecoverableClientRuntimeError,
} from "@/lib/runtime/clientRecovery";

function createStorageMock() {
  const backing = new Map<string, string>();

  return {
    getItem(key: string) {
      return backing.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      backing.set(key, value);
    },
  };
}

describe("client runtime recovery", () => {
  it("detects stale chunk-load style failures", () => {
    expect(isRecoverableClientRuntimeError(new Error("ChunkLoadError: Loading chunk 123 failed."))).toBe(true);
    expect(
      isRecoverableClientRuntimeError({
        reason: { message: "Failed to fetch dynamically imported module: /_next/static/chunks/app/sign-in/page.js" },
      })
    ).toBe(true);
    expect(isRecoverableClientRuntimeError(new Error("Random application error"))).toBe(false);
  });

  it("extracts nested error messages", () => {
    expect(
      getClientRuntimeErrorMessage({
        reason: {
          cause: new Error("Failed to fetch server response for /sign-in"),
        },
      })
    ).toBe("Failed to fetch server response for /sign-in");
  });

  it("reloads only once per release guard key", () => {
    const storage = createStorageMock();
    const onReload = vi.fn();
    const releaseId = "run-123";

    expect(
      attemptRecoverFromClientRuntimeError(new Error("Loading chunk 77 failed."), {
        releaseId,
        storage,
        onReload,
      })
    ).toBe(true);
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(storage.getItem(buildClientRecoveryStorageKey(releaseId))).toBe("1");

    expect(
      attemptRecoverFromClientRuntimeError(new Error("Loading chunk 77 failed."), {
        releaseId,
        storage,
        onReload,
      })
    ).toBe(false);
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("does not reload unsupported errors", () => {
    const storage = createStorageMock();
    const onReload = vi.fn();

    expect(
      attemptRecoverFromClientRuntimeError(new Error("User profile request failed"), {
        releaseId: "run-456",
        storage,
        onReload,
      })
    ).toBe(false);
    expect(onReload).not.toHaveBeenCalled();
  });
});
