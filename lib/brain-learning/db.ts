import { Pool } from "pg";

let pool: Pool | null = null;

export function getBrainLearningPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("Missing required env var: DATABASE_URL");
  }
  pool = new Pool({ connectionString });
  return pool;
}
