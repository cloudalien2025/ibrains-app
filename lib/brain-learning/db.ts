import { Pool } from "pg";

let pool: Pool | null = null;
let directoryIqPool: Pool | null = null;

export function getBrainLearningPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("Missing required env var: DATABASE_URL");
  }
  pool = new Pool({ connectionString });
  return pool;
}

export function getDirectoryIqPool(): Pool {
  if (directoryIqPool) return directoryIqPool;
  const connectionString =
    process.env.DIRECTORYIQ_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("Missing required env var: DIRECTORYIQ_DATABASE_URL or DATABASE_URL");
  }
  directoryIqPool = new Pool({ connectionString });
  return directoryIqPool;
}
