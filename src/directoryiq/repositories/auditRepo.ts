export type AuditEvent = {
  reqId: string;
  userId: string;
  listingId: string;
  action: string;
  status: "ok" | "error";
  details?: string;
  createdAt: string;
};

const memoryAudit: AuditEvent[] = [];

export async function writeAuditEvent(event: Omit<AuditEvent, "createdAt">): Promise<void> {
  memoryAudit.push({
    ...event,
    createdAt: new Date().toISOString(),
  });
}

export async function listAuditEvents(limit = 20): Promise<AuditEvent[]> {
  return memoryAudit.slice(-Math.max(1, limit)).reverse();
}
