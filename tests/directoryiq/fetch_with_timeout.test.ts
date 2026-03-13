import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJsonWithTimeout, RequestTimeoutError } from "@/lib/directoryiq/fetchWithTimeout";

describe("fetchJsonWithTimeout", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON when request succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchJsonWithTimeout<{ ok: boolean }>("http://example.test/api", undefined, 1000);
    expect(result.response.status).toBe(200);
    expect(result.json.ok).toBe(true);
  });

  it("throws RequestTimeoutError when fetch hangs past timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchJsonWithTimeout("http://example.test/hang", undefined, 25);
    const assertion = expect(pending).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });
});
