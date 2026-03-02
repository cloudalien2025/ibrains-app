import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { bdRequestRaw, firstArray, loadBdRuntimeConfig } from "./_bdRuntime.mjs";

const { Client } = pg;

function asObject(value) {
  return value && typeof value === "object" ? value : null;
}

function extractDataRows(payload) {
  return firstArray(payload).map(asObject).filter(Boolean);
}

function pickGroupId(rows, preferredId) {
  if (preferredId) {
    const hit = rows.find((row) => String(row.group_id ?? row.id ?? "") === String(preferredId));
    if (hit) return String(hit.group_id ?? hit.id);
  }
  const first = rows[0];
  if (!first) return null;
  const id = first.group_id ?? first.id ?? first.portfolio_group_id;
  return id == null ? null : String(id);
}

function pickPhotoId(groupPayload) {
  const root = asObject(groupPayload);
  if (!root) return null;
  const msg = asObject(root.message) || root;
  const photos = [
    ...(Array.isArray(msg.users_portfolio) ? msg.users_portfolio : []),
    ...(Array.isArray(msg.photos) ? msg.photos : []),
    ...(Array.isArray(msg.portfolio) ? msg.portfolio : []),
  ].map(asObject).filter(Boolean);
  const first = photos[0];
  if (!first) return null;
  const id = first.photo_id ?? first.id ?? first.portfolio_id;
  return id == null ? null : String(id);
}

async function readListingMeta(listingIds) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const res = await client.query(
      "select source_id, raw_json->>'user_id' as user_id, raw_json->>'data_id' as data_id from directoryiq_nodes where source_type='listing' and source_id = any($1)",
      [listingIds]
    );
    const out = new Map();
    for (const row of res.rows) {
      out.set(String(row.source_id), {
        userId: String(row.user_id || ""),
        dataId: String(row.data_id || "75"),
      });
    }
    return out;
  } finally {
    await client.end();
  }
}

async function main() {
  const outDir = path.join(process.cwd(), "artifacts", "bd");
  await fs.mkdir(outDir, { recursive: true });
  const runtime = await loadBdRuntimeConfig();
  const ids = ["321", "3", "8"];
  const listingMeta = await readListingMeta(ids);

  const report = ["# PORTFOLIO_ENDPOINT_REPORT", ""];

  for (const id of ids) {
    const meta = listingMeta.get(id) || { userId: id, dataId: "75" };

    const searchUserOnly = await bdRequestRaw({
      baseUrl: runtime.baseUrl,
      apiKey: runtime.apiKey,
      method: "POST",
      requestPath: "/api/v2/users_portfolio_groups/search",
      form: { user_id: id },
    });

    const userOnlyJson = searchUserOnly.json ?? { raw: searchUserOnly.text };
    await fs.writeFile(path.join(outDir, `portfolio_groups_search_${id}.json`), JSON.stringify(userOnlyJson, null, 2), "utf8");

    report.push(`## user_id ${id}`);
    report.push(`- groups/search (form: user_id=${id}) status: ${searchUserOnly.status}`);

    if (searchUserOnly.status === 404 || searchUserOnly.status === 405) {
      report.push("- groups/search supported: no");
      report.push(`- reason: endpoint returned ${searchUserOnly.status}`);
      report.push("");
      continue;
    }

    const searchWithData = await bdRequestRaw({
      baseUrl: runtime.baseUrl,
      apiKey: runtime.apiKey,
      method: "POST",
      requestPath: "/api/v2/users_portfolio_groups/search",
      form: {
        output_type: "array",
        action: "search",
        page: "1",
        limit: "200",
        data_id: meta.dataId,
        user_id: meta.userId || id,
      },
    });

    const dataRows = extractDataRows(searchWithData.json);
    report.push(`- groups/search (data-aware) status: ${searchWithData.status}`);
    report.push(`- groups/search (data-aware) rows: ${dataRows.length}`);

    const groupId = pickGroupId(dataRows, id);
    report.push(`- selected group_id: ${groupId ?? "none"}`);

    if (!groupId) {
      report.push("- group/get skipped: no matching group id in response");
      report.push("");
      continue;
    }

    const groupGet = await bdRequestRaw({
      baseUrl: runtime.baseUrl,
      apiKey: runtime.apiKey,
      method: "GET",
      requestPath: `/api/v2/users_portfolio_groups/get/${encodeURIComponent(groupId)}`,
    });

    await fs.writeFile(path.join(outDir, `portfolio_group_get_${groupId}.json`), JSON.stringify(groupGet.json ?? { raw: groupGet.text }, null, 2), "utf8");
    report.push(`- group/get status: ${groupGet.status}`);

    const photoId = pickPhotoId(groupGet.json);
    report.push(`- first photo_id: ${photoId ?? "none"}`);

    if (!photoId) {
      report.push("- photo/get skipped: no photo ids in group payload");
      report.push("");
      continue;
    }

    const photoGet = await bdRequestRaw({
      baseUrl: runtime.baseUrl,
      apiKey: runtime.apiKey,
      method: "GET",
      requestPath: `/api/v2/users_portfolio/get/${encodeURIComponent(photoId)}`,
    });

    await fs.writeFile(path.join(outDir, `portfolio_photo_get_${photoId}.json`), JSON.stringify(photoGet.json ?? { raw: photoGet.text }, null, 2), "utf8");
    report.push(`- photo/get status: ${photoGet.status}`);
    report.push("");
  }

  await fs.writeFile(path.join(outDir, "PORTFOLIO_ENDPOINT_REPORT.md"), report.join("\n"), "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
