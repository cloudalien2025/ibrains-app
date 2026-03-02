import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";

const { Client } = pg;

function parseEncryptionKey() {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY || process.env.SERVER_ENCRYPTION_KEY;
  if (!raw) throw new Error("Missing INTEGRATIONS_ENCRYPTION_KEY/SERVER_ENCRYPTION_KEY");
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  const key = Buffer.from(trimmed, "base64");
  if (key.length !== 32) throw new Error("Encryption key must decode to 32 bytes");
  return key;
}

function decryptSecret(payloadB64, context) {
  const key = parseEncryptionKey();
  const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  if (context) decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const clear = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return clear.toString("utf8");
}

function extractKeys(obj, prefix = "", out = []) {
  if (!obj || typeof obj !== "object") return out;
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => extractKeys(item, `${prefix}[${idx}]`, out));
    return out;
  }
  for (const [key, value] of Object.entries(obj)) {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    if (/(photo|image|logo|cover|banner|profile|avatar|pic|gallery|file|thumbnail|url)/i.test(key)) {
      out.push({ key: nextPath, value });
    }
    extractKeys(value, nextPath, out);
  }
  return out;
}

function classifyValue(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (/^https?:\/\//i.test(text)) return "absolute";
  if (text.startsWith("/")) return "relative-root";
  if (text.length === 0 || text === "\"\"" || text === "null") return "empty";
  return "relative-or-other";
}

function reportPriority(pathKey, value) {
  const key = pathKey.toLowerCase();
  const shape = classifyValue(value);
  let score = 0;
  if (shape === "absolute") score += 100;
  if (key.includes("file_main_full_url")) score += 50;
  if (key.includes("file_thumbnail_full_url")) score += 30;
  if (key.endsWith(".file")) score += 20;
  if (key.includes("original_image_url")) score -= 25;
  if (shape === "empty") score -= 50;
  return score;
}

function keepReportField(pathKey, value) {
  const key = pathKey.toLowerCase();
  if (
    !/(file_main_full_url|file_thumbnail_full_url|original_image_url|profile_photo|cover_image|cover_photo|logo|avatar|image_url|main_image|group_picture|default_picture|\.file)$/i.test(
      pathKey
    )
  ) {
    return false;
  }
  if (
    key.includes("token") ||
    key.includes("date_") ||
    key.includes("imported") ||
    key.includes("photo_filename") ||
    key.includes("data_category")
  ) {
    return false;
  }
  const valueShape = classifyValue(value);
  if (valueShape === "empty") return false;
  return true;
}

async function bdRequest(baseUrl, apiKey, method, requestPath, form) {
  const url = new URL(requestPath, baseUrl).toString();
  const response = await fetch(url, {
    method,
    headers: {
      "X-Api-Key": apiKey,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? new URLSearchParams(form || {}).toString() : undefined,
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, json };
}

function firstArray(payload) {
  const msg = payload?.message;
  if (Array.isArray(msg)) return msg;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function main() {
  const outDir = path.join(process.cwd(), "artifacts", "bd-samples");
  await fs.mkdir(outDir, { recursive: true });

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const rowRes = await client.query(
    "select user_id, secret_ciphertext, meta_json from integrations_credentials where product='directoryiq' and provider='brilliant_directories' limit 1"
  );
  if (rowRes.rows.length === 0) throw new Error("No DirectoryIQ Brilliant Directories integration row found");
  const row = rowRes.rows[0];
  const userId = String(row.user_id);
  const apiKey = decryptSecret(String(row.secret_ciphertext), `${userId}:directoryiq:brilliant_directories`);
  const baseUrl = String(row.meta_json?.baseUrl || row.meta_json?.base_url || "");
  if (!baseUrl) throw new Error("BD baseUrl missing in integration meta");

  const reportLines = [];
  reportLines.push("# IMAGE FIELD REPORT");
  reportLines.push("");
  reportLines.push(`Base URL: ${baseUrl}`);
  reportLines.push("");

  for (const id of ["321", "8"]) {
    const listingRowRes = await client.query(
      "select raw_json->>'user_id' as owner_user_id, raw_json->>'data_id' as data_id from directoryiq_nodes where source_type='listing' and source_id=$1 limit 1",
      [id]
    );
    const ownerUserId = String(listingRowRes.rows[0]?.owner_user_id || "");
    const dataId = String(listingRowRes.rows[0]?.data_id || "75");

    const userGet = await bdRequest(baseUrl, apiKey, "GET", `/api/v2/user/get/${id}`);
    const ownerUserGet = ownerUserId ? await bdRequest(baseUrl, apiKey, "GET", `/api/v2/user/get/${ownerUserId}`) : null;
    await fs.writeFile(path.join(outDir, `user_get_${id}.json`), JSON.stringify(userGet.json, null, 2), "utf8");
    if (ownerUserGet) {
      await fs.writeFile(
        path.join(outDir, `user_get_owner_${id}.json`),
        JSON.stringify(ownerUserGet.json, null, 2),
        "utf8"
      );
    }

    const groupsByUser = await bdRequest(baseUrl, apiKey, "POST", "/api/v2/users_portfolio_groups/search", {
      output_type: "array",
      action: "search",
      page: "1",
      limit: "100",
      data_id: dataId,
      user_id: ownerUserId || id,
    });
    const groupsByGroup = await bdRequest(baseUrl, apiKey, "POST", "/api/v2/users_portfolio_groups/search", {
      output_type: "array",
      action: "search",
      page: "1",
      limit: "100",
      data_id: dataId,
      group_id: id,
    });

    const selectedGroupsPayload = firstArray(groupsByGroup.json).length > 0 ? groupsByGroup : groupsByUser;
    await fs.writeFile(
      path.join(outDir, `portfolio_groups_${id}.json`),
      JSON.stringify(selectedGroupsPayload.json, null, 2),
      "utf8"
    );

    const groups = firstArray(selectedGroupsPayload.json);
    const selectedGroup =
      groups.find((g) => String(g.group_id || "") === id) ||
      groups.find((g) => String(g.group_cover || "") === "1") ||
      groups[0];

    let photoPayload = {};
    if (selectedGroup?.group_id || id) {
      const groupId = selectedGroup?.group_id || id;
      const groupGet = await bdRequest(baseUrl, apiKey, "GET", `/api/v2/users_portfolio_groups/get/${groupId}`);
      const groupJson = groupGet.json;
      const photos = Array.isArray(groupJson?.message?.users_portfolio) ? groupJson.message.users_portfolio : [];
      const selectedPhoto =
        photos.find((p) => String(p.group_cover || "") === "1") ||
        photos.sort((a, b) => Number(a.order || 9999) - Number(b.order || 9999))[0];
      if (selectedPhoto?.photo_id) {
        const photoGet = await bdRequest(baseUrl, apiKey, "GET", `/api/v2/users_portfolio/get/${selectedPhoto.photo_id}`);
        photoPayload = photoGet.json;
      } else {
        photoPayload = groupJson;
      }
    }
    await fs.writeFile(path.join(outDir, `portfolio_photo_${id}.json`), JSON.stringify(photoPayload, null, 2), "utf8");

    const foundUser = extractKeys(userGet.json);
    const foundOwnerUser = ownerUserGet ? extractKeys(ownerUserGet.json) : [];
    const foundGroups = extractKeys(selectedGroupsPayload.json);
    const foundPhoto = extractKeys(photoPayload);

    const allFoundRaw = [
      ...foundUser.map((item) => ({ scope: "user_get_listing_id", ...item })),
      ...foundOwnerUser.map((item) => ({ scope: "user_get_owner_id", ...item })),
      ...foundGroups.map((item) => ({ scope: "portfolio_groups", ...item })),
      ...foundPhoto.map((item) => ({ scope: "portfolio_photo", ...item })),
    ];
    const seen = new Set();
    const allFound = allFoundRaw.filter((item) => {
      if (!keepReportField(item.key, item.value)) return false;
      const token = `${item.scope}:${item.key}`;
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    });
    const allFoundSorted = allFound.sort((a, b) => {
      const scoreA = reportPriority(a.key, a.value);
      const scoreB = reportPriority(b.key, b.value);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return a.key.localeCompare(b.key);
    });
    const topFields = allFoundSorted.slice(0, 16);
    const absoluteUrls = allFoundSorted
      .filter((item) => classifyValue(item.value) === "absolute")
      .slice(0, 5);

    reportLines.push(`## user_id ${id}`);
    reportLines.push(`- listing-id->user/get status: ${userGet.status}`);
    reportLines.push(`- owner user_id from listing data: ${ownerUserId || "unknown"}`);
    reportLines.push(`- owner-user->user/get status: ${ownerUserGet ? ownerUserGet.status : "n/a"}`);
    reportLines.push(`- groups/search status: ${selectedGroupsPayload.status}`);
    reportLines.push(`- top image-like fields across payloads:`);
    if (topFields.length === 0) {
      reportLines.push("  - none");
    } else {
      for (const item of topFields) {
        const value = typeof item.value === "string" ? item.value : JSON.stringify(item.value);
        const shape = classifyValue(value);
        reportLines.push(`  - [${item.scope}] ${item.key}: ${String(value).slice(0, 180)} (${shape})`);
      }
    }
    reportLines.push(`- usable absolute image URLs (sample):`);
    if (absoluteUrls.length === 0) {
      reportLines.push("  - none");
    } else {
      for (const item of absoluteUrls) {
        const value = typeof item.value === "string" ? item.value : JSON.stringify(item.value);
        reportLines.push(`  - [${item.scope}] ${item.key}: ${String(value).slice(0, 180)}`);
      }
    }
    reportLines.push("");
  }

  await fs.writeFile(path.join(outDir, "IMAGE_FIELD_REPORT.md"), reportLines.join("\n"), "utf8");
  await client.end();
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
