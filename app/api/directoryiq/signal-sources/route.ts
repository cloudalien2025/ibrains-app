export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { encryptSecret } from "@/app/api/ecomviper/_utils/crypto";
import { query } from "@/app/api/ecomviper/_utils/db";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  isDirectoryIqConnector,
  toDirectoryIqStatus,
  type DirectoryIqConnector,
  type DirectoryIqCredentialRow,
} from "@/lib/directoryiq/signalSourceCredentials";

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const rows = await query<DirectoryIqCredentialRow>(
      `
      SELECT connector_id, label, secret_last4, secret_length, updated_at, config_json
      FROM directoryiq_signal_source_credentials
      WHERE user_id = $1
      ORDER BY connector_id ASC
      `,
      [userId]
    );

    return NextResponse.json({ connectors: toDirectoryIqStatus(rows) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DirectoryIQ signal-source error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const body = (await req.json()) as {
      connector_id?: string;
      secret?: string;
      label?: string | null;
      config?: Record<string, string> | null;
    };

    const connectorId = (body.connector_id ?? "").trim().toLowerCase() as DirectoryIqConnector;
    const secret = (body.secret ?? "").trim();

    if (!isDirectoryIqConnector(connectorId)) {
      return NextResponse.json({ error: "Unsupported connector_id" }, { status: 400 });
    }

    if (!secret) {
      return NextResponse.json({ error: "secret is required" }, { status: 400 });
    }

    const ciphertext = encryptSecret(secret, `${userId}:directoryiq:${connectorId}`);
    const secretLast4 = secret.slice(-4);
    const secretLength = secret.length;

    const configJson =
      body.config && typeof body.config === "object"
        ? Object.fromEntries(
            Object.entries(body.config).filter(
              ([, value]) => typeof value === "string" && value.trim().length > 0
            )
          )
        : {};

    await query(
      `
      INSERT INTO directoryiq_signal_source_credentials
      (user_id, connector_id, secret_ciphertext, secret_last4, secret_length, label, config_json, last_verified_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
      ON CONFLICT (user_id, connector_id)
      DO UPDATE SET
        secret_ciphertext = EXCLUDED.secret_ciphertext,
        secret_last4 = EXCLUDED.secret_last4,
        secret_length = EXCLUDED.secret_length,
        label = EXCLUDED.label,
        config_json = EXCLUDED.config_json,
        last_verified_at = now(),
        updated_at = now()
      `,
      [userId, connectorId, ciphertext, secretLast4, secretLength, body.label?.trim() || null, JSON.stringify(configJson)]
    );

    return NextResponse.json({ ok: true, connector_id: connectorId, connected: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DirectoryIQ credential save error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const connectorId = (req.nextUrl.searchParams.get("connector_id") ?? "").trim().toLowerCase() as DirectoryIqConnector;
    if (!isDirectoryIqConnector(connectorId)) {
      return NextResponse.json({ error: "Unsupported connector_id" }, { status: 400 });
    }

    await query(
      `DELETE FROM directoryiq_signal_source_credentials WHERE user_id = $1 AND connector_id = $2`,
      [userId, connectorId]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DirectoryIQ credential delete error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
