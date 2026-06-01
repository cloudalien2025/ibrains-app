import { afterEach, describe, expect, it } from "vitest";

describe("shopify openai runtime key fallback", () => {
  const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalDirectoryIqDatabaseUrl = process.env.DIRECTORYIQ_DATABASE_URL;

  afterEach(() => {
    if (typeof originalOpenAiApiKey === "undefined") delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiApiKey;
    if (typeof originalDatabaseUrl === "undefined") delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (typeof originalDirectoryIqDatabaseUrl === "undefined") delete process.env.DIRECTORYIQ_DATABASE_URL;
    else process.env.DIRECTORYIQ_DATABASE_URL = originalDirectoryIqDatabaseUrl;
  });

  it("returns OPENAI_API_KEY when credential store is unavailable", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.DIRECTORYIQ_DATABASE_URL;
    process.env.OPENAI_API_KEY = "sk-runtime-key";

    const { getShopifyOpenAiApiKeyForUser } = await import("@/lib/ecomviper/shopify/openai-connection");
    const result = await getShopifyOpenAiApiKeyForUser("user_1");

    expect(result).toBe("sk-runtime-key");
  });
});
