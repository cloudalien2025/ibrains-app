import { NextRequest } from "next/server.js";

import { pathToFileURL } from "url";
import path from "path";

const rootDir = path.resolve(new URL(".", import.meta.url).pathname, "..");

async function loadHandler(modulePath) {
  const url = pathToFileURL(path.join(rootDir, modulePath)).href;
  return import(url);
}

const brainsModule = await loadHandler(".next/server/app/api/brains/route.js");
const brainModule = await loadHandler(".next/server/app/api/brains/[id]/route.js");
const brainRunsModule = await loadHandler(".next/server/app/api/brains/[id]/runs/route.js");
const runsModule = await loadHandler(".next/server/app/api/runs/[runId]/route.js");
const runsDiagModule = await loadHandler(
  ".next/server/app/api/runs/[runId]/diagnostics/route.js"
);

function getRouteModule(mod) {
  return mod.routeModule || mod.default?.routeModule;
}

const { GET: brainsGET } = getRouteModule(brainsModule).userland;
const { GET: brainGET } = getRouteModule(brainModule).userland;
const { POST: brainRunsPOST } = getRouteModule(brainRunsModule).userland;
const { GET: runsGET } = getRouteModule(runsModule).userland;
const { GET: runsDiagGET } = getRouteModule(runsDiagModule).userland;

const BASE = process.env.BRAINS_API_BASE || "http://mock.local";
process.env.BRAINS_API_BASE = BASE;
process.env.BRAINS_WORKER_API_KEY = process.env.BRAINS_WORKER_API_KEY || "worker_test";
process.env.BRAINS_USER_ID = process.env.BRAINS_USER_ID || "user_test";

const calls = [];

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

global.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.toString();
  const parsed = new URL(url);
  const method = init.method || "GET";
  calls.push({ method, url: parsed.toString() });

  const path = parsed.pathname;
  if (method === "GET" && path === "/v1/health") {
    return jsonResponse(200, { ok: true });
  }
  if (method === "GET" && path === "/v1/brains/public") {
    return jsonResponse(200, { items: [] });
  }
  const brainMatch = path.match(/^\/v1\/brains\/([^/]+)$/);
  if (method === "GET" && brainMatch) {
    return jsonResponse(200, { id: brainMatch[1], name: "Mock Brain", public: true });
  }
  const brainRunsMatch = path.match(/^\/v1\/brains\/([^/]+)\/runs$/);
  if (brainRunsMatch) {
    if (method === "POST") {
      return jsonResponse(202, { run_id: "run_mock_1", brain_id: brainRunsMatch[1] });
    }
    if (method === "GET") {
      return jsonResponse(200, { items: [] });
    }
  }
  const runMatch = path.match(/^\/v1\/runs\/([^/]+)$/);
  if (method === "GET" && runMatch) {
    return jsonResponse(200, { run_id: runMatch[1], status: "running" });
  }
  const diagMatch = path.match(/^\/v1\/runs\/([^/]+)\/diagnostics$/);
  if (method === "GET" && diagMatch) {
    return jsonResponse(200, { run_id: diagMatch[1], status: "ok" });
  }

  return jsonResponse(404, { error: "not_found" });
};

function makeRequest(url, init = {}) {
  return new NextRequest(url, init);
}

async function expectStatus(res, expected, label) {
  if (res.status !== expected) {
    const body = await res.text().catch(() => "");
    throw new Error(`${label} expected ${expected}, got ${res.status}. Body: ${body}`);
  }
}

async function run() {
  const brainsRes = await brainsGET(makeRequest("http://localhost/api/brains"));
  await expectStatus(brainsRes, 200, "GET /api/brains");
  await brainsRes.json();

  const brainRes = await brainGET(makeRequest("http://localhost/api/brains/testbrain"), {
    params: { id: "testbrain" },
  });
  await expectStatus(brainRes, 200, "GET /api/brains/[id]");
  await brainRes.json();

  const runPostRes = await brainRunsPOST(
    makeRequest("http://localhost/api/brains/testbrain/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit: 1 }),
    }),
    { params: { id: "testbrain" } }
  );
  await expectStatus(runPostRes, 202, "POST /api/brains/[id]/runs");
  const runPostBody = await runPostRes.json();
  const runId = runPostBody.run_id;
  if (!runId) {
    throw new Error("Missing run_id in POST /api/brains/[id]/runs response");
  }

  const runRes = await runsGET(makeRequest(`http://localhost/api/runs/${runId}`), {
    params: { runId },
  });
  await expectStatus(runRes, 200, "GET /api/runs/[runId]");
  await runRes.json();

  const diagRes = await runsDiagGET(
    makeRequest(`http://localhost/api/runs/${runId}/diagnostics`),
    { params: { runId } }
  );
  await expectStatus(diagRes, 200, "GET /api/runs/[runId]/diagnostics");
  await diagRes.json();

  const expectedCalls = [
    { method: "GET", path: "/v1/brains/public" },
    { method: "GET", path: "/v1/brains/testbrain" },
    { method: "POST", path: "/v1/brains/testbrain/runs" },
    { method: "GET", path: `/v1/runs/${runId}` },
    { method: "GET", path: `/v1/runs/${runId}/diagnostics` },
  ];

  for (const expected of expectedCalls) {
    const matched = calls.some((call) => {
      const url = new URL(call.url);
      return call.method === expected.method && url.pathname === expected.path;
    });
    if (!matched) {
      throw new Error(`Expected outbound call not found: ${expected.method} ${expected.path}`);
    }
  }

  console.log("Adapter verification OK.");
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
