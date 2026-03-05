import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { resolveGraphIntegrityGate } from "@/src/directoryiq/services/graphIntegrity/featureFlags";
import { queryDb } from "@/src/directoryiq/repositories/db";

const STATUSES = new Set(["open", "ignored", "resolved"]);
const TYPES = new Set(["mention_without_link", "weak_anchor_text", "orphan_listing"]);

export async function GET(req: NextRequest) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const tenantId = req.nextUrl.searchParams.get("tenantId") ?? "default";
    const status = req.nextUrl.searchParams.get("status");
    const type = req.nextUrl.searchParams.get("type");
    const listingNodeId = req.nextUrl.searchParams.get("listingNodeId");
    const blogNodeId = req.nextUrl.searchParams.get("blogNodeId");
    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 50), 1), 200);
    const offset = Math.max(Number(req.nextUrl.searchParams.get("offset") ?? 0), 0);

    if (status && !STATUSES.has(status)) {
      return NextResponse.json(
        { ok: false, error: { message: "Invalid status", code: "BAD_REQUEST", reqId } },
        { status: 400 }
      );
    }

    if (type && !TYPES.has(type)) {
      return NextResponse.json(
        { ok: false, error: { message: "Invalid leak type", code: "BAD_REQUEST", reqId } },
        { status: 400 }
      );
    }

    const user = resolveUserFromHeaders(req.headers);
    const gate = resolveGraphIntegrityGate({ tenantId, userFeatures: user.features as string[] | undefined });
    if (!gate.enabled) {
      return NextResponse.json(
        { ok: false, error: { message: "Graph integrity not enabled", code: gate.reason, reqId } },
        { status: 403 }
      );
    }

    const filters: string[] = ["l.tenant_id = $1"];
    const params: unknown[] = [tenantId];

    if (status) {
      params.push(status);
      filters.push(`l.status = $${params.length}`);
    }

    if (type) {
      params.push(type);
      filters.push(`l.leak_type = $${params.length}`);
    }

    if (listingNodeId) {
      params.push(listingNodeId);
      filters.push(`l.listing_node_id = $${params.length}`);
    }

    if (blogNodeId) {
      params.push(blogNodeId);
      filters.push(`l.blog_node_id = $${params.length}`);
    }

    params.push(limit);
    const limitIndex = params.length;
    params.push(offset);
    const offsetIndex = params.length;

    const rows = await queryDb<{
      id: string;
      leak_type: string;
      severity: number;
      status: string;
      evidence_json: Record<string, unknown> | null;
      last_detected_at: string;
      blog_node_id: string | null;
      listing_node_id: string | null;
      blog_title: string | null;
      blog_url: string | null;
      listing_title: string | null;
      listing_url: string | null;
    }>(
      `
      SELECT
        l.id,
        l.leak_type,
        l.severity,
        l.status,
        l.evidence_json,
        l.last_detected_at,
        l.blog_node_id,
        l.listing_node_id,
        b.title AS blog_title,
        b.canonical_url AS blog_url,
        ln.title AS listing_title,
        ln.canonical_url AS listing_url
      FROM directoryiq_authority_leaks l
      LEFT JOIN authority_graph_nodes b ON b.id = l.blog_node_id
      LEFT JOIN authority_graph_nodes ln ON ln.id = l.listing_node_id
      WHERE ${filters.join(" AND ")}
      ORDER BY l.last_detected_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
      `,
      params
    );

    return NextResponse.json({
      ok: true,
      reqId,
      leaks: rows.map((row) => ({
        id: row.id,
        leakType: row.leak_type,
        severity: row.severity,
        status: row.status,
        evidence: row.evidence_json ?? {},
        lastDetectedAt: row.last_detected_at,
        blog: row.blog_node_id
          ? { id: row.blog_node_id, title: row.blog_title, url: row.blog_url }
          : null,
        listing: row.listing_node_id
          ? { id: row.listing_node_id, title: row.listing_title, url: row.listing_url }
          : null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list leaks";
    return NextResponse.json(
      { ok: false, error: { message, code: "INTERNAL_ERROR", reqId } },
      { status: 500 }
    );
  }
}
