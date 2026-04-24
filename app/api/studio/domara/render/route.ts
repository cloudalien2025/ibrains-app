import { NextResponse } from "next/server";
import { createDomaraRenderPlan, DomaraVideoRenderRequest } from "@/lib/studio/domara/render-plan";
import { PropertyListingInput, PropertyVideoPlan } from "@/lib/studio/domara/types";
import { renderDomaraPropertyVideo } from "@/lib/studio/domara/video-renderer";

export const runtime = "nodejs";

function badRequest(message: string, details?: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        message,
        details,
      },
    },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  if (!payload || typeof payload !== "object") {
    return badRequest("Render payload object is required.");
  }

  const cast = payload as Partial<DomaraVideoRenderRequest>;
  if (!cast.plan || !cast.listingInput) {
    return badRequest("Both plan and listingInput are required.");
  }
  if (!cast.plan.id || !Array.isArray(cast.plan.scenes)) {
    return badRequest("Invalid plan payload.");
  }

  if (!cast.listingInput.title || !cast.listingInput.country) {
    return badRequest("Listing title and country are required.");
  }

  try {
    const plan = cast.plan as PropertyVideoPlan;
    const listingInput = cast.listingInput as PropertyListingInput;
    const renderPlan = createDomaraRenderPlan({
      plan,
      listingInput,
    });
    const result = await renderDomaraPropertyVideo(renderPlan);
    return NextResponse.json({
      ok: true,
      render: result,
      metadata: {
        timelineScenes: renderPlan.timeline.length,
        channel: renderPlan.channel,
        useCase: renderPlan.useCase,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: "Failed to render Domara MP4.",
          details: error instanceof Error ? error.message : "Unknown rendering failure.",
        },
      },
      { status: 500 },
    );
  }
}
