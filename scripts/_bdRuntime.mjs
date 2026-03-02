import crypto from "node:crypto";
import pg from "pg";

const { Client } = pg;

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Missing ${name}`);
  return value.trim();
}

function parseEncryptionKey() {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY || process.env.SERVER_ENCRYPTION_KEY;
  if (!raw) throw new Error("Missing INTEGRATIONS_ENCRYPTION_KEY or SERVER_ENCRYPTION_KEY");
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  const key = Buffer.from(trimmed, "base64");
  if (key.length !== 32) throw new Error("Encryption key must decode to 32 bytes");
  return key;
}

function decryptSecret(payloadB64, context) {
  const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
  const key = parseEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  if (context) decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const clear = Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()]);
  return clear.toString("utf8");
}

function normalizeBaseUrl(baseUrl) {
  const raw = String(baseUrl || "").trim();
  if (!raw) throw new Error("BD baseUrl is empty");
  const withProtocol = raw.includes("://") ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

export async function loadBdRuntimeConfig() {
  const client = new Client({
    connectionString: requireEnv("DATABASE_URL"),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const rowRes = await client.query(
      `
      select user_id, secret_ciphertext, meta_json, updated_at
      from integrations_credentials
      where product='directoryiq' and provider='brilliant_directories'
      order by updated_at desc
      limit 1
      `
    );
    if (rowRes.rows.length === 0) {
      throw new Error("No Brilliant Directories integration credentials found for directoryiq");
    }
    const row = rowRes.rows[0];
    const userId = String(row.user_id);
    const baseUrl = normalizeBaseUrl(String(row.meta_json?.baseUrl || row.meta_json?.base_url || ""));
    const apiKey = decryptSecret(String(row.secret_ciphertext), `${userId}:directoryiq:brilliant_directories`);
    return {
      userId,
      baseUrl,
      apiKey,
      updatedAt: row.updated_at ? String(row.updated_at) : null,
    };
  } finally {
    await client.end();
  }
}

export async function bdRequestRaw({ baseUrl, apiKey, method, requestPath, form }) {
  const url = new URL(requestPath, `${baseUrl}/`).toString();
  const response = await fetch(url, {
    method,
    headers: {
      "X-Api-Key": apiKey,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? new URLSearchParams(form || {}).toString() : undefined,
    cache: "no-store",
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    text,
    json: (() => {
      try {
        return text ? JSON.parse(text) : null;
      } catch {
        return null;
      }
    })(),
  };
}

export function firstArray(payload) {
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.message)) return payload.message;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.records)) return payload.records;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}
