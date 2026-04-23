import { getDirectoryIqPool } from "@/lib/brain-learning/db";

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const pool = getDirectoryIqPool();
  const result = await pool.query<T>(text, params as unknown[]);
  return result.rows;
}
