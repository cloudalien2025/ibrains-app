export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getDirectoryIqBdConnection } from "@/app/api/directoryiq/_utils/integrations";
import { getBlogIngestionJob, startBlogIngestionJob } from "@/app/api/directoryiq/_utils/authorityGraph";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId") ?? "";
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }
  const job = getBlogIngestionJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = resolveUserId(req);
    await ensureUser(tenantId);

    const body = (await req.json().catch(() => ({}))) as { baseUrl?: string; dryRun?: boolean };
    const baseUrl = (body.baseUrl ?? "").trim();

    let effectiveBaseUrl = baseUrl;
    if (!effectiveBaseUrl) {
      const bd = await getDirectoryIqBdConnection(tenantId);
      effectiveBaseUrl = bd?.baseUrl ?? "";
    }

    if (!effectiveBaseUrl) {
      return NextResponse.json(
        { error: "baseUrl is required. Configure BD integration or pass baseUrl explicitly." },
        { status: 400 }
      );
    }

    const job = startBlogIngestionJob({
      tenantId,
      baseUrl: effectiveBaseUrl,
      dryRun: body.dryRun === true,
    });

    return NextResponse.json({
      ok: true,
      jobId: job.jobId,
      status: job.status,
      dryRun: job.dryRun,
      baseUrl: effectiveBaseUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start authority ingestion" },
      { status: 500 }
    );
  }
}
