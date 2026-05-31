import { createEcommercePool, getRequiredEcommerceDatabaseUrl, maskConnectionString } from "@/lib/ecommerce/database";

async function main(): Promise<void> {
  const connectionString = getRequiredEcommerceDatabaseUrl();
  const maskedTarget = maskConnectionString(connectionString);
  const pool = createEcommercePool(connectionString);

  try {
    const result = await pool.query<{ ok: number }>("SELECT 1 AS ok");
    const ok = Number(result.rows[0]?.ok) === 1;

    if (!ok) {
      throw new Error("Unexpected response to SELECT 1");
    }

    console.log(`[ecommerce:check-db] Connection successful: ${maskedTarget}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ecommerce:check-db] Connection failed: ${maskedTarget} (${message})`);
    process.exitCode = 1;
  } finally {
    const endPool = (pool as unknown as { end?: () => Promise<void> }).end;
    if (typeof endPool === "function") {
      await endPool.call(pool).catch(() => undefined);
    }
  }
}

void main();
