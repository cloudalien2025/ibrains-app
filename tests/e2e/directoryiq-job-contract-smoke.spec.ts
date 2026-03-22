import { type APIRequestContext, expect, test } from "@playwright/test";

type JobAccepted = {
  jobId?: string;
  reqId?: string;
  acceptedAt?: string;
  status?: string;
  statusEndpoint?: string;
};

type JobStatus = {
  status?: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  stage?: string;
  reqId?: string;
  error?: { message?: string; code?: string };
};

async function pollJobStatus(
  request: APIRequestContext,
  endpoint: string,
  timeoutMs = 12_000
): Promise<JobStatus> {
  const deadline = Date.now() + timeoutMs;
  let latest: JobStatus = {};

  while (Date.now() < deadline) {
    const res = await request.get(endpoint);
    expect(res.status()).toBe(200);
    latest = (await res.json()) as JobStatus;
    if (latest.status === "succeeded" || latest.status === "failed" || latest.status === "cancelled") return latest;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return latest;
}

test("Step2 draft submit returns accepted job contract", async ({ request }) => {
  const res = await request.post("/api/directoryiq/listings/321/authority/1/draft?site_id=site-1", {
    data: {
      type: "local_guide",
      focus_topic: "local service guide",
      title: "Fixture title",
    },
  });
  expect(res.status()).toBe(202);

  const body = (await res.json()) as JobAccepted;
  expect(body.jobId).toBeTruthy();
  expect(body.reqId).toBeTruthy();
  expect(body.acceptedAt).toBeTruthy();
  expect(body.status).toBe("queued");
  expect(body.statusEndpoint).toContain("/api/directoryiq/jobs/");

  const status = await pollJobStatus(request, String(body.statusEndpoint));
  expect(status.reqId).toBeTruthy();
  expect(["queued", "running", "succeeded", "failed", "cancelled"]).toContain(status.status);
});

test("Step3 generate submit returns accepted job contract and status lifecycle", async ({ request }) => {
  const res = await request.post("/api/directoryiq/listings/321/upgrade/generate?site_id=site-1", {
    data: { mode: "default" },
  });
  expect(res.status()).toBe(202);

  const body = (await res.json()) as JobAccepted;
  expect(body.jobId).toBeTruthy();
  expect(body.reqId).toBeTruthy();
  expect(body.acceptedAt).toBeTruthy();
  expect(body.status).toBe("queued");
  expect(body.statusEndpoint).toContain("/api/directoryiq/jobs/");

  const status = await pollJobStatus(request, String(body.statusEndpoint));
  expect(status.reqId).toBeTruthy();
  expect(["running", "succeeded", "failed", "cancelled"]).toContain(status.status);
  expect(status.stage).toBeTruthy();
});
