export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getLatestFileIqResolvedProductBySupplierAndSku } from "@/lib/fileiq/fileiq-reconciliation";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ supplierId: string; sku: string }> | { supplierId: string; sku: string } },
): Promise<NextResponse> {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;
  if (!userId) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign-in required." },
      { status: 401 },
    );
  }

  const { supplierId, sku } = await Promise.resolve(params);
  const resolved = await getLatestFileIqResolvedProductBySupplierAndSku(supplierId, sku);
  if (!resolved) {
    return NextResponse.json(
      { error: "not_found", message: "No reconciled FileIQ product was found for this supplier and SKU." },
      { status: 404 },
    );
  }

  return NextResponse.json(resolved);
}
