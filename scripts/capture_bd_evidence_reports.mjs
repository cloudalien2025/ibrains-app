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
  const clear = Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()]);
  return clear.toString("utf8");
}

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function extractFields(obj, prefix = "", out = []) {
  if (!obj || typeof obj !== "object") return out;
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => extractFields(item, `${prefix}[${idx}]`, out));
    return out;
  }
  for (const [key, value] of Object.entries(obj)) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    if (/(photo|image|logo|cover|banner|avatar|profile|pic|gallery|portfolio)/i.test(key)) {
      out.push({ path: pathKey, value });
    }
    extractFields(value, pathKey, out);
  }
  return out;
}

function unwrapMessage(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.message && typeof payload.message === "object" && !Array.isArray(payload.message)) return payload.message;
  if (Array.isArray(payload.message)) return payload.message[0] || {};
  return payload;
}

async function bdRequest(baseUrl, apiKey, method, requestPath, form) {
  const url = new URL(requestPath, baseUrl).toString();
  const response = await fetch(url, {
    method,
    headers: {
      "X-Api-Key": apiKey,
      ...(method === "POST" || method === "PUT"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body:
      method === "POST" || method === "PUT"
        ? new URLSearchParams(
            Object.entries(form || {}).reduce((acc, [k, v]) => {
              if (v == null) return acc;
              acc[k] = String(v);
              return acc;
            }, {})
          ).toString()
        : undefined,
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, json };
}

function pickDescriptionField(userPayload, listingRaw) {
  const user = unwrapMessage(userPayload);
  const ordered = ["group_desc", "description", "short_description", "post_body", "about_me", "bio"];
  for (const field of ordered) {
    const v1 = typeof user[field] === "string" ? user[field].trim() : "";
    const v2 = typeof listingRaw[field] === "string" ? listingRaw[field].trim() : "";
    if (v1 || v2) return { field, currentValue: v1 || v2 };
  }
  return { field: "group_desc", currentValue: "" };
}

function extractPublicImage(html) {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1] || null;
  if (og) return { method: "og:image", url: og };
  const img = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)?.[1] || null;
  if (img) return { method: "first-img", url: img };
  return { method: "none", url: null };
}

async function main() {
  const outDir = path.join(process.cwd(), "artifacts", "bd-samples");
  await fs.mkdir(outDir, { recursive: true });

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const integrationRes = await client.query(
    "select user_id, secret_ciphertext, meta_json from integrations_credentials where product='directoryiq' and provider='brilliant_directories' limit 1"
  );
  if (integrationRes.rows.length === 0) throw new Error("No DirectoryIQ BD integration found");
  const integration = integrationRes.rows[0];
  const ownerUserId = String(integration.user_id);
  const apiKey = decryptSecret(String(integration.secret_ciphertext), `${ownerUserId}:directoryiq:brilliant_directories`);
  const baseUrl = String(integration.meta_json?.baseUrl || integration.meta_json?.base_url || "");
  if (!baseUrl) throw new Error("BD baseUrl missing");

  const listingIds = ["321", "3"];
  const imageReport = [];
  let descriptionReport = ["# DESCRIPTION_FIELD_REPORT", "", `Base URL: ${baseUrl}`, ""];

  for (const listingId of listingIds) {
    const listingRes = await client.query(
      "select raw_json, url from directoryiq_nodes where source_type='listing' and source_id=$1 limit 1",
      [listingId]
    );
    const listingRaw = asObject(listingRes.rows[0]?.raw_json || {});
    const listingUrl = listingRes.rows[0]?.url || "";
    const bdUserId = String(listingRaw.user_id || listingId);

    const userGet = await bdRequest(baseUrl, apiKey, "GET", `/api/v2/user/get/${encodeURIComponent(bdUserId)}`);
    await fs.writeFile(path.join(outDir, `user_get_${listingId}.json`), JSON.stringify(userGet.json, null, 2), "utf8");

    const allImageFields = extractFields(userGet.json).slice(0, 120);
    imageReport.push(`## user_id ${listingId}`);
    imageReport.push(`- bd_user_id used: ${bdUserId}`);
    imageReport.push(`- user/get status: ${userGet.status}`);
    if (allImageFields.length === 0) {
      imageReport.push("- image-like fields: none");
    } else {
      imageReport.push("- image-like fields:");
      for (const row of allImageFields) {
        const value = typeof row.value === "string" ? row.value : JSON.stringify(row.value);
        const shape = /^https?:\/\//i.test(value) ? "absolute" : value?.startsWith("/") ? "relative-root" : "other";
        imageReport.push(`  - ${row.path}: ${String(value).slice(0, 160)} (${shape})`);
      }
    }
    imageReport.push("");

    if (listingId === "3") {
      const { field, currentValue } = pickDescriptionField(userGet.json, listingRaw);
      const marker = `${currentValue} [probe-${Date.now()}]`.slice(0, 3500);
      const probe = await bdRequest(baseUrl, apiKey, "PUT", "/api/v2/user/update", {
        user_id: bdUserId,
        [field]: marker,
      });
      const verify = await bdRequest(baseUrl, apiKey, "GET", `/api/v2/user/get/${encodeURIComponent(bdUserId)}`);
      const verifyMessage = unwrapMessage(verify.json);
      const readBack = String(verifyMessage[field] || "");
      const changed = readBack === marker;
      await bdRequest(baseUrl, apiKey, "PUT", "/api/v2/user/update", {
        user_id: bdUserId,
        [field]: currentValue,
      });

      descriptionReport.push(`## listing_id ${listingId}`);
      descriptionReport.push(`- bd_user_id: ${bdUserId}`);
      descriptionReport.push(`- chosen field: ${field}`);
      descriptionReport.push(`- update status: ${probe.status}`);
      descriptionReport.push(`- readback status: ${verify.status}`);
      descriptionReport.push(`- round-trip changed: ${changed ? "yes" : "no"}`);
      descriptionReport.push(`- original length: ${currentValue.length}`);
      descriptionReport.push("");
    }

    if (listingId === "321" && listingUrl) {
      const page = await fetch(listingUrl, {
        method: "GET",
        headers: { "User-Agent": "iBrainsBot/1.0 evidence capture" },
      });
      const html = await page.text();
      await fs.writeFile(path.join(outDir, "public_listing_html_321.html"), html.slice(0, 180000), "utf8");
      const extracted = extractPublicImage(html);
      await fs.writeFile(
        path.join(outDir, "public_image_extraction_321.json"),
        JSON.stringify(
          {
            listing_url: listingUrl,
            method: extracted.method,
            picked_url: extracted.url,
          },
          null,
          2
        ),
        "utf8"
      );
    }
  }

  await fs.writeFile(
    path.join(outDir, "IMAGE_FIELD_REPORT.md"),
    ["# IMAGE_FIELD_REPORT", "", `Base URL: ${baseUrl}`, "", ...imageReport].join("\n"),
    "utf8"
  );
  await fs.writeFile(path.join(outDir, "DESCRIPTION_FIELD_REPORT.md"), descriptionReport.join("\n"), "utf8");

  await client.end();
  console.log("Wrote artifacts to artifacts/bd-samples");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
