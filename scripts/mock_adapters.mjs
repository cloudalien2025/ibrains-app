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

  if (method === "GET" && path === "/v1/brains/public") {
    return json(res, 200, { items: [] });
  }

  const brainMatch = path.match(/^\/v1\/brains\/([^/]+)$/);
  if (method === "GET" && brainMatch) {
    const id = brainMatch[1];
    return json(res, 200, { id, name: "Mock Brain", public: true });
  }

  const brainRunsMatch = path.match(/^\/v1\/brains\/([^/]+)\/runs$/);
  if (brainRunsMatch) {
    const id = brainRunsMatch[1];
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
    if (method === "GET") {
      return json(res, 200, { items: [] });
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

  json(res, 404, { error: "not_found" });
});

server.listen(port, "127.0.0.1", () => {
  log(`Mock adapters listening on http://127.0.0.1:${port}`);
});
