import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/app/api/ecomviper/_utils/crypto";

const prior = process.env.INTEGRATIONS_ENCRYPTION_KEY;

describe("integrations encryption", () => {
  afterEach(() => {
    if (prior) process.env.INTEGRATIONS_ENCRYPTION_KEY = prior;
    else delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
    delete process.env.SERVER_ENCRYPTION_KEY;
  });

  it("round-trips secrets with aad context", () => {
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.from("12345678901234567890123456789012").toString("base64");
    const secret = "super-secret-token";
    const context = "u1:directoryiq:openai";
    const encrypted = encryptSecret(secret, context);
    const decrypted = decryptSecret(encrypted, context);
    expect(decrypted).toBe(secret);
    expect(encrypted).not.toContain(secret);
  });

  it("decrypts legacy payloads encrypted with server key when integrations key changed", () => {
    process.env.SERVER_ENCRYPTION_KEY = Buffer.from("abcdefghijklmnopqrstuvwx12345678").toString("base64");
    process.env.INTEGRATIONS_ENCRYPTION_KEY = process.env.SERVER_ENCRYPTION_KEY;
    const context = "u1:directoryiq:openai";
    const secret = "legacy-secret-token";
    const encrypted = encryptSecret(secret, context);

    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.from("12345678901234567890123456789012").toString("base64");
    const decrypted = decryptSecret(encrypted, context);
    expect(decrypted).toBe(secret);
  });
});
