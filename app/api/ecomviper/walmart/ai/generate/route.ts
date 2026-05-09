export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { generateWalmartAiSuggestion } from "@/lib/ecomviper/walmart/walmart-ai-optimizer";
import { getWalmartOpenAiApiKeyForUser } from "@/lib/ecomviper/walmart/walmart-openai-connection";
import { getWalmartProductBySkuForUser } from "@/lib/ecomviper/walmart/walmart-products";

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before generating Walmart product content.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before generating Walmart product content.", "UNAUTHORIZED");
    }

    const body = (await req.json().catch(() => ({}))) as { sku?: unknown };
    const sku = typeof body.sku === "string" ? body.sku.trim() : "";

    if (!sku) {
      return fail(400, "sku is required.", "BAD_REQUEST");
    }

    const openAiApiKey = await getWalmartOpenAiApiKeyForUser(userId);
    if (!openAiApiKey) {
      return fail(
        400,
        "Connect your OpenAI API key first to generate product content.",
        "OPENAI_NOT_CONNECTED"
      );
    }

    const product = await getWalmartProductBySkuForUser(userId, sku);
    if (!product) {
      return fail(404, `Product not found for SKU: ${sku}`, "NOT_FOUND");
    }

    const suggestion = await generateWalmartAiSuggestion({
      product,
      openAiApiKey,
    });

    return ok({
      ok: true,
      suggestion,
      message: "Walmart product content generated successfully.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate Walmart product content.";
    return fail(502, message, "GENERATION_FAILED");
  }
}
