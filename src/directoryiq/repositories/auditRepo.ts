import { queryDb } from "@/src/directoryiq/repositories/db";

export type AuditEvent = {
  reqId: string;
  userId: string;
  listingId: string;
  action: string;
  status: "ok" | "error";
  details?: string;
};

const memoryAudit: Array<AuditEvent & { createdAt: string }> = [];

function canUseDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

async function ensureAuditTable(): Promise<void> {
  if (!canUseDb()) return;
  await queryDb(`
    CREATE TABLE IF NOT EXISTS directoryiq_audit_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      req_id TEXT NOT NULL,
      user_id UUID NOT NULL,
      listing_source_id TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      details TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function writeAuditEvent(event: AuditEvent): Promise<void> {
  if (!canUseDb()) {
    memoryAudit.push({ ...event, createdAt: new Date().toISOString() });
    return;
  }

  await ensureAuditTable();
  await queryDb(
    `
    INSERT INTO directoryiq_audit_events (req_id, user_id, listing_source_id, action, status, details)
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [event.reqId, event.userId, event.listingId, event.action, event.status, event.details ?? null]
  );
}
