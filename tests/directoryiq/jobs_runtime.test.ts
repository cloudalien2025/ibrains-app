import { describe, expect, it, vi } from "vitest";

const queryMock = vi.fn(async () => []);

vi.mock("@/app/api/ecomviper/_utils/db", () => ({
  query: queryMock,
}));

async function waitFor<T>(fn: () => Promise<T>, predicate: (value: T) => boolean): Promise<T> {
  const timeoutAt = Date.now() + 2_000;
  while (Date.now() < timeoutAt) {
    const value = await fn();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return fn();
}

describe("directoryiq jobs runtime", () => {
  it("stores submission, transitions stages, and logs reqId/jobId for success", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const { createDirectoryIqJob, getDirectoryIqJobForUser, runDirectoryIqJob } = await import(
        "@/app/api/directoryiq/_utils/jobs"
      );

      const job = await createDirectoryIqJob({
        reqId: "req-success-123",
        userId: "00000000-0000-4000-8000-000000000001",
        kind: "step3.generate",
        listingId: "site-1:321",
        siteId: "site-1",
      });

      runDirectoryIqJob(job, {
        routeOrigin: "directoryiq.upgrade.step3.generate",
        runtimeOwner: "directoryiq-api.ibrains.ai",
        startedStage: "generating",
        processor: async ({ setStage }) => {
          await setStage("persisting");
          return { draftId: "draft-1", reqId: "req-upgrade" };
        },
      });

      const completed = await waitFor(
        async () => getDirectoryIqJobForUser(job.id, job.userId),
        (value) => Boolean(value && value.status === "succeeded")
      );

      expect(completed?.status).toBe("succeeded");
      expect(completed?.stage).toBe("ready");
      expect(completed?.result).toMatchObject({ draftId: "draft-1" });

      const submissionLog = infoSpy.mock.calls.find((call) => call[0] === "[directoryiq-job]" && call[1]?.phase === "submission");
      const successLog = infoSpy.mock.calls.find((call) => call[0] === "[directoryiq-job]" && call[1]?.phase === "final_success");
      expect(submissionLog?.[1]).toMatchObject({
        routeOrigin: "directoryiq.upgrade.step3.generate",
        reqId: job.reqId,
        jobId: job.id,
        runtimeOwner: "directoryiq-api.ibrains.ai",
      });
      expect(successLog?.[1]).toMatchObject({
        reqId: job.reqId,
        jobId: job.id,
        phase: "final_success",
      });
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("records normalized failure status and safe error payload", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const { createDirectoryIqJob, getDirectoryIqJobForUser, runDirectoryIqJob } = await import(
        "@/app/api/directoryiq/_utils/jobs"
      );

      const job = await createDirectoryIqJob({
        reqId: "req-failure-456",
        userId: "00000000-0000-4000-8000-000000000001",
        kind: "step2.image",
        listingId: "site-1:654",
        siteId: "site-1",
        slot: 2,
      });

      runDirectoryIqJob(job, {
        routeOrigin: "directoryiq.authority.step2.image",
        runtimeOwner: "directoryiq-api.ibrains.ai",
        startedStage: "generating",
        processor: async () => {
          throw Object.assign(new Error("OpenAI key missing"), { code: "OPENAI_KEY_MISSING" });
        },
      });

      const completed = await waitFor(
        async () => getDirectoryIqJobForUser(job.id, job.userId),
        (value) => Boolean(value && value.status === "failed")
      );

      expect(completed?.status).toBe("failed");
      expect(completed?.stage).toBe("failed");
      expect(completed?.error).toMatchObject({
        code: "OPENAI_KEY_MISSING",
        codeFamily: "openai",
      });

      const failureLog = infoSpy.mock.calls.find((call) => call[0] === "[directoryiq-job]" && call[1]?.phase === "final_failure");
      expect(failureLog?.[1]).toMatchObject({
        reqId: job.reqId,
        jobId: job.id,
        code: "OPENAI_KEY_MISSING",
        codeFamily: "openai",
      });
    } finally {
      infoSpy.mockRestore();
    }
  });
});

