export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getOrCreateLatestFileIqReconciledCatalogForSupplier } from "@/lib/fileiq/fileiq-reconciliation";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ supplierId: string }> | { supplierId: string } },
): Promise<NextResponse> {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;
  if (!userId) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign-in required." },
      { status: 401 },
    );
  }

  const { supplierId } = await Promise.resolve(params);
  const record = await getOrCreateLatestFileIqReconciledCatalogForSupplier(supplierId);
  if (!record) {
    return NextResponse.json(
      { error: "not_found", message: "No reconciled FileIQ catalog is available for this supplier yet." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    supplierId: record.supplierId,
    status: record.status,
    schemaVersion: record.schemaVersion,
    catalog: record.catalog,
    metadata: record.metadata,
    createdAt: record.createdAt,
  });
}
