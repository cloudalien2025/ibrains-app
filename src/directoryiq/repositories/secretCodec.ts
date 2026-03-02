import crypto from "crypto";

type CipherPayload = {
  iv: string;
  tag: string;
  ciphertext: string;
};

function parseEncryptionKey(): Buffer {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY ?? process.env.SERVER_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("INTEGRATIONS_ENCRYPTION_KEY not configured");
  }

  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  const key = Buffer.from(trimmed, "base64");
  if (key.length !== 32) {
    throw new Error("INTEGRATIONS_ENCRYPTION_KEY must be 32 bytes (base64 or hex)");
  }
  return key;
}

export function decryptSecret(payloadB64: string, context?: string): string {
  const key = parseEncryptionKey();
  const payloadJson = Buffer.from(payloadB64, "base64").toString("utf8");
  const payload = JSON.parse(payloadJson) as CipherPayload;

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  if (context) {
    decipher.setAAD(Buffer.from(context, "utf8"));
  }
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
