import { NextRequest } from "next/server.js";
import crypto from "crypto";
import fs from "fs";

import { pathToFileURL } from "url";
import path from "path";

const rootDir = path.resolve(new URL(".", import.meta.url).pathname, "..");

async function loadHandler(modulePath) {
  const url = pathToFileURL(path.join(rootDir, modulePath)).href;
  return import(url);
}

function resolveManifestPath() {
  const candidate = path.join(rootDir, ".next/server/app-paths-manifest.json");
  if (fs.existsSync(candidate)) return candidate;
  throw new Error("Missing .next/server/app-paths-manifest.json. Run `npm run build` first.");
}

const manifestPath = resolveManifestPath();
const appPathsManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

async function loadRouteModule(routeKey) {
  const compiledPath =
    appPathsManifest[routeKey] ??
    appPathsManifest[routeKey.replace(/\/route$/, "")];
  if (!compiledPath) {
    throw new Error(`Missing route in app-paths-manifest: ${routeKey}`);
  }
  // Manifest values are relative to `.next/server`.
  const serverRoot = path.join(rootDir, ".next/server");
  return loadHandler(path.relative(rootDir, path.join(serverRoot, compiledPath)));
}

const brainsModule = await loadRouteModule("/api/brains/route");
const brainModule = await loadRouteModule("/api/brains/[id]/route");
const brainIngestModule = await loadRouteModule("/api/brains/[id]/ingest/route");
const runsModule = await loadRouteModule("/api/runs/[runId]/route");
const runsDiagModule = await loadRouteModule("/api/runs/[runId]/diagnostics/route");
const runsReportModule = await loadRouteModule("/api/runs/[runId]/report/route");
const runsFilesModule = await loadRouteModule("/api/runs/[runId]/files/route");
const runsBrainPackModule = await loadRouteModule("/api/runs/[runId]/brain-pack/route");
const brainPackModule = await loadRouteModule("/api/brain-packs/[packId]/route");

function getRouteModule(mod) {
  return mod.routeModule || mod.default?.routeModule;
}

const { GET: brainsGET } = getRouteModule(brainsModule).userland;
const { GET: brainGET } = getRouteModule(brainModule).userland;
const { POST: brainIngestPOST } = getRouteModule(brainIngestModule).userland;
const { GET: runsGET } = getRouteModule(runsModule).userland;
const { GET: runsDiagGET } = getRouteModule(runsDiagModule).userland;
const { GET: runsReportGET } = getRouteModule(runsReportModule).userland;
const { GET: runsFilesGET } = getRouteModule(runsFilesModule).userland;
const { POST: runsBrainPackPOST } = getRouteModule(runsBrainPackModule).userland;
const { GET: brainPackGET } = getRouteModule(brainPackModule).userland;

const BASE = process.env.BRAINS_API_BASE || "http://mock.local";
process.env.BRAINS_API_BASE = BASE;
process.env.BRAINS_WORKER_API_KEY = process.env.BRAINS_WORKER_API_KEY || "worker_test";
process.env.BRAINS_MASTER_KEY = process.env.BRAINS_MASTER_KEY || "master_test";
process.env.BRAINS_USER_ID = process.env.BRAINS_USER_ID || crypto.randomUUID();

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
  if (method === "GET" && path === "/v1/brains") {
    return jsonResponse(200, { items: [] });
  }
  const brainMatch = path.match(/^\/v1\/brains\/([^/]+)$/);
  if (method === "GET" && brainMatch) {
    return jsonResponse(200, { id: brainMatch[1], name: "Mock Brain", public: true });
  }
  const brainIngestMatch = path.match(/^\/v1\/brains\/([^/]+)\/ingest$/);
  if (brainIngestMatch) {
    if (method === "POST") {
      return jsonResponse(202, { run_id: "run_mock_1", brain_id: brainIngestMatch[1] });
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
  const reportMatch = path.match(/^\/v1\/runs\/([^/]+)\/report$/);
  if (method === "GET" && reportMatch) {
    return jsonResponse(200, { run_id: reportMatch[1], summary: { ok: true } });
  }
  const filesMatch = path.match(/^\/v1\/runs\/([^/]+)\/files$/);
  if (method === "GET" && filesMatch) {
    return jsonResponse(200, { run_id: filesMatch[1], artifact_files: [] });
  }
  const runPackMatch = path.match(/^\/v1\/runs\/([^/]+)\/brain-pack$/);
  if (method === "POST" && runPackMatch) {
    return jsonResponse(200, { run_id: runPackMatch[1], brain_pack_id: "pack_mock_1" });
  }
  const packMatch = path.match(/^\/v1\/brain-packs\/([^/]+)$/);
  if (method === "GET" && packMatch) {
    return jsonResponse(200, { brain_pack_id: packMatch[1], status: "completed" });
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

  const runPostRes = await brainIngestPOST(
    makeRequest("http://localhost/api/brains/testbrain/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        keyword: "testbrain",
        selected_new: 1,
        n_new_videos: 1,
        max_candidates: 50,
        mode: "audio_first",
      }),
    }),
    { params: { id: "testbrain" } }
  );
  await expectStatus(runPostRes, 202, "POST /api/brains/[id]/ingest");
  const runPostBody = await runPostRes.json();
  const runId = runPostBody.run_id;
  if (!runId) {
    throw new Error("Missing run_id in POST /api/brains/[id]/ingest response");
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

  const reportRes = await runsReportGET(
    makeRequest(`http://localhost/api/runs/${runId}/report`),
    { params: { runId } }
  );
  await expectStatus(reportRes, 200, "GET /api/runs/[runId]/report");
  await reportRes.json();

  const filesRes = await runsFilesGET(
    makeRequest(`http://localhost/api/runs/${runId}/files`),
    { params: { runId } }
  );
  await expectStatus(filesRes, 200, "GET /api/runs/[runId]/files");
  await filesRes.json();

  const runPackRes = await runsBrainPackPOST(
    makeRequest(`http://localhost/api/runs/${runId}/brain-pack`, {
      method: "POST",
      headers: { "content-type": "application/json" },
    }),
    { params: { runId } }
  );
  await expectStatus(runPackRes, 200, "POST /api/runs/[runId]/brain-pack");
  const runPackBody = await runPackRes.json();
  const packId = runPackBody.brain_pack_id;
  if (!packId) {
    throw new Error("Missing brain_pack_id in POST /api/runs/[runId]/brain-pack response");
  }

  const packRes = await brainPackGET(
    makeRequest(`http://localhost/api/brain-packs/${packId}`),
    { params: { packId } }
  );
  await expectStatus(packRes, 200, "GET /api/brain-packs/[packId]");
  await packRes.json();

  const expectedCalls = [
    { method: "GET", path: "/v1/brains" },
    { method: "GET", path: "/v1/brains/testbrain" },
    { method: "POST", path: "/v1/brains/testbrain/ingest" },
    { method: "GET", path: `/v1/runs/${runId}` },
    { method: "GET", path: `/v1/runs/${runId}/diagnostics` },
    { method: "GET", path: `/v1/runs/${runId}/report` },
    { method: "GET", path: `/v1/runs/${runId}/files` },
    { method: "POST", path: `/v1/runs/${runId}/brain-pack` },
    { method: "GET", path: `/v1/brain-packs/${packId}` },
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
