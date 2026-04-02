import http from "http";
import { URL } from "url";
import fs from "fs";

const port = Number(process.env.MOCK_PORT || 4010);
const logFile = process.env.MOCK_LOG || "";

function log(line) {
  const entry = `${new Date().toISOString()} ${line}`;
  if (logFile) {
    fs.appendFileSync(logFile, `${entry}\n`);
  }
  // Keep stdout minimal but visible when run interactively
  if (!logFile) {
    console.log(entry);
  }
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;
  const method = req.method || "GET";

  log(`${method} ${path}`);

  if (method === "GET" && path === "/v1/health") {
    return json(res, 200, { ok: true });
  }

  if (method === "GET" && path === "/v1/brains") {
    return json(res, 200, { items: [] });
  }

  const brainMatch = path.match(/^\/v1\/brains\/([^/]+)$/);
  if (method === "GET" && brainMatch) {
    const id = brainMatch[1];
    return json(res, 200, { id, name: "Mock Brain", public: true });
  }

  const brainIngestMatch = path.match(/^\/v1\/brains\/([^/]+)\/ingest$/);
  if (brainIngestMatch) {
    const id = brainIngestMatch[1];
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        json(res, 202, { run_id: "run_mock_1", brain_id: id });
      });
      return;
    }
  }

  const runMatch = path.match(/^\/v1\/runs\/([^/]+)$/);
  if (method === "GET" && runMatch) {
    const runId = runMatch[1];
    return json(res, 200, { run_id: runId, status: "running" });
  }

  const diagMatch = path.match(/^\/v1\/runs\/([^/]+)\/diagnostics$/);
  if (method === "GET" && diagMatch) {
    const runId = diagMatch[1];
    return json(res, 200, { run_id: runId, status: "ok" });
  }

  const reportMatch = path.match(/^\/v1\/runs\/([^/]+)\/report$/);
  if (method === "GET" && reportMatch) {
    const runId = reportMatch[1];
    return json(res, 200, { run_id: runId, summary: { ok: true } });
  }

  const filesMatch = path.match(/^\/v1\/runs\/([^/]+)\/files$/);
  if (method === "GET" && filesMatch) {
    const runId = filesMatch[1];
    return json(res, 200, { run_id: runId, artifact_files: [] });
  }

  const runPackMatch = path.match(/^\/v1\/runs\/([^/]+)\/brain-pack$/);
  if (method === "POST" && runPackMatch) {
    const runId = runPackMatch[1];
    return json(res, 200, { run_id: runId, brain_pack_id: "pack_mock_1" });
  }

  const packMatch = path.match(/^\/v1\/brain-packs\/([^/]+)$/);
  if (method === "GET" && packMatch) {
    const packId = packMatch[1];
    return json(res, 200, { brain_pack_id: packId, status: "completed" });
  }

  const downloadMatch = path.match(/^\/v1\/brain-packs\/([^/]+)\/download$/);
  if (method === "GET" && downloadMatch) {
    const payload = JSON.stringify({ ok: true, pack_id: downloadMatch[1] });
    res.writeHead(200, {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload),
    });
    res.end(payload);
    return;
  }

  json(res, 404, { error: "not_found" });
});

server.listen(port, "127.0.0.1", () => {
  log(`Mock adapters listening on http://127.0.0.1:${port}`);
});
