export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { GET as getSignalSources } from "@/app/api/directoryiq/signal-sources/route";

type SignalSourcesResponse = {
  connectors?: Array<{
    connector_id?: string;
    connected?: boolean;
  }>;
  error?: string;
};

function connectorState(connectors: SignalSourcesResponse["connectors"], connectorId: string): boolean | null {
  const connector = Array.isArray(connectors)
    ? connectors.find((entry) => entry?.connector_id === connectorId)
    : null;
  if (!connector || typeof connector.connected !== "boolean") return null;
  return connector.connected;
}

export async function GET(req: NextRequest) {
  if (process.env.E2E_MOCK_GRAPH === "1") {
    return NextResponse.json({
      openaiConfigured: false,
      bdConfigured: false,
      integrations: [],
    });
  }

  try {
    const signalSourcesRes = await getSignalSources(req);
    const signalSourcesJson = (await signalSourcesRes.json().catch(() => ({}))) as SignalSourcesResponse;
    if (!signalSourcesRes.ok) {
      return NextResponse.json(signalSourcesJson, { status: signalSourcesRes.status });
    }

    const openaiConfigured = connectorState(signalSourcesJson.connectors, "openai");
    const bdConfigured = connectorState(signalSourcesJson.connectors, "brilliant_directories_api");

    return NextResponse.json({
      openaiConfigured,
      bdConfigured,
      integrations: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve DirectoryIQ integrations";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
