import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/app/api/ecomviper/_utils/crypto";

const prior = process.env.INTEGRATIONS_ENCRYPTION_KEY;

describe("integrations encryption", () => {
  afterEach(() => {
    if (prior) process.env.INTEGRATIONS_ENCRYPTION_KEY = prior;
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
});
