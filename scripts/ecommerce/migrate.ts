import path from "node:path";
import {
  createEcommercePool,
  getRequiredEcommerceDatabaseUrl,
  maskConnectionString,
} from "@/lib/ecommerce/database";
import { runEcommerceMigrations } from "@/lib/ecommerce/migration-runner";

async function main(): Promise<void> {
  const connectionString = getRequiredEcommerceDatabaseUrl();
  const maskedTarget = maskConnectionString(connectionString);
  const pool = createEcommercePool(connectionString);
  const migrationsDirectory = path.join(process.cwd(), "db/ecommerce/migrations");

  try {
    const result = await runEcommerceMigrations({
      pool,
      migrationsDirectory,
      maskedTarget,
    });

    console.log(`[ecommerce:migrate] target=${result.target}`);
    console.log(`[ecommerce:migrate] directory=${result.directory}`);
    console.log(`[ecommerce:migrate] applied=${result.applied.length} skipped=${result.skipped.length}`);

    if (result.applied.length > 0) {
      console.log(`[ecommerce:migrate] applied migrations: ${result.applied.join(", ")}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ecommerce:migrate] failed: ${message}`);
    process.exitCode = 1;
  } finally {
    const endPool = (pool as unknown as { end?: () => Promise<void> }).end;
    if (typeof endPool === "function") {
      await endPool.call(pool).catch(() => undefined);
    }
  }
}

void main();
