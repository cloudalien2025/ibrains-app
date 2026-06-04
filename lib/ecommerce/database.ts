import { Pool } from "pg";

let ecommercePool: Pool | null = null;

export function getRequiredEcommerceDatabaseUrl(): string {
  const connectionString = process.env.ECOMMERCE_DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("Missing required env var: ECOMMERCE_DATABASE_URL");
  }
  return connectionString;
}

export function maskConnectionString(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);

    const username = parsed.username ? decodeURIComponent(parsed.username) : "";
    const hasPassword = Boolean(parsed.password);
    const auth = username ? `${encodeURIComponent(username)}${hasPassword ? ":***" : ""}@` : "";

    return `${parsed.protocol}//${auth}${parsed.host}${parsed.pathname}`;
  } catch {
    return "[invalid-connection-string]";
  }
}

export function createEcommercePool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

export function getEcommercePool(): Pool {
  if (ecommercePool) return ecommercePool;
  ecommercePool = createEcommercePool(getRequiredEcommerceDatabaseUrl());
  return ecommercePool;
}

export async function queryEcommerce<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await getEcommercePool().query<T>(text, params as unknown[]);
  return result.rows;
}
