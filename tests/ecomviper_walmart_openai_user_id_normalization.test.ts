import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWalmartOpenAiApiKeyForUser,
  saveWalmartOpenAiConnectionForUser,
} from "@/lib/ecomviper/walmart/walmart-openai-connection";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@/app/api/ecomviper/_utils/db", () => ({
  query: mocks.query,
}));

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 29).toString("base64");
const UUID_V4ISH = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("Walmart OpenAI user id normalization", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalDirectoryIqDatabaseUrl = process.env.DIRECTORYIQ_DATABASE_URL;
  const originalEncryptionKey = process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://example.test:5432/ibrains";
    process.env.DIRECTORYIQ_DATABASE_URL = "postgresql://example.test:5432/ibrains";
    process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    mocks.query.mockReset();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.DIRECTORYIQ_DATABASE_URL = originalDirectoryIqDatabaseUrl;
    process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY = originalEncryptionKey;
    mocks.query.mockReset();
  });

  it("stores and resolves credentials for Clerk-style user ids via deterministic UUID", async () => {
    const rows = new Map<string, { secret_ciphertext: string; secret_last4: string | null; secret_length: number | null; updated_at: string }>();
    let insertedUserId: string | null = null;

    mocks.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      const normalizedSql = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (normalizedSql.includes("to_regclass('public.directoryiq_signal_source_credentials')")) {
        return [{ exists: "directoryiq_signal_source_credentials" }];
      }

      if (normalizedSql.startsWith("insert into directoryiq_signal_source_credentials")) {
        const userId = String(params[0] ?? "");
        insertedUserId = userId;
        rows.set(userId, {
          secret_ciphertext: String(params[2] ?? ""),
          secret_last4: (params[3] as string | null) ?? null,
          secret_length: Number(params[4] ?? 0),
          updated_at: "2026-05-09T00:00:00.000Z",
        });
        return [];
      }

      if (normalizedSql.startsWith("select secret_ciphertext, secret_last4, secret_length, updated_at from directoryiq_signal_source_credentials")) {
        const userId = String(params[0] ?? "");
        const row = rows.get(userId);
        return row ? [row] : [];
      }

      throw new Error(`Unhandled query in test: ${normalizedSql}`);
    });

    const saveStatus = await saveWalmartOpenAiConnectionForUser({
      userId: "user_ibrains",
      apiKey: "sk-test-openai-secret-123456",
    });

    expect(saveStatus.connected).toBe(true);
    expect(insertedUserId).toBeTruthy();
    expect(insertedUserId).not.toBe("user_ibrains");
    expect(UUID_V4ISH.test(insertedUserId ?? "")).toBe(true);

    const decrypted = await getWalmartOpenAiApiKeyForUser("user_ibrains");
    expect(decrypted).toBe("sk-test-openai-secret-123456");

    const queriedUserIds = mocks.query.mock.calls
      .filter((call) => String(call[0]).toLowerCase().includes("from directoryiq_signal_source_credentials"))
      .map((call) => String(call[1]?.[0] ?? ""));

    expect(new Set(queriedUserIds)).toEqual(new Set([insertedUserId]));
  });
});
