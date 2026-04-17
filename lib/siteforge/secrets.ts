import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { createId } from "@/lib/siteforge/utils";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function decodeKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  const b64 = Buffer.from(trimmed, "base64");
  if (b64.length === 32) {
    return b64;
  }

  return createHash("sha256").update(trimmed).digest();
}

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const configured = process.env.SITEFORGE_SECRET_KEY || process.env.APP_ENCRYPTION_KEY || "siteforge-dev-key";
  cachedKey = decodeKey(configured);
  return cachedKey;
}

export function encryptSecret(secret: string): { ref: string; cipherText: string } {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);

  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ref: createId("sfsec"),
    cipherText: `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`,
  };
}

export function decryptSecret(cipherText: string): string {
  const [ivB64, tagB64, encryptedB64] = cipherText.split(".");
  if (!ivB64 || !tagB64 || !encryptedB64) {
    throw new Error("Invalid encrypted secret payload.");
  }

  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
