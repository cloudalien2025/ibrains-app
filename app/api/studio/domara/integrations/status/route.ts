import { NextResponse } from "next/server";
import { getDomaraIntegrationCapabilityMap } from "@/lib/studio/domara/integrations";

export const runtime = "nodejs";

export async function GET() {
  const result = getDomaraIntegrationCapabilityMap();
  return NextResponse.json({
    ok: true,
    providers: result.statuses,
    capabilities: result.capabilities,
    generatedAt: new Date().toISOString(),
    securityNote: "Provider secrets are never returned to the client.",
  });
}
