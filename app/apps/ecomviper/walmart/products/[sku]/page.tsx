import ProductEditorClient from "@/app/apps/ecomviper/walmart/products/[sku]/product-editor-client";
import { getWalmartProductBySkuForUser, isWalmartProductArchivedForUser } from "@/lib/ecomviper/walmart/walmart-products";
import { listWalmartDraftsForUser } from "@/lib/ecomviper/walmart/walmart-drafts";
import { getWalmartOpenAiConnectionStatusForUser } from "@/lib/ecomviper/walmart/walmart-openai-connection";
import { getWalmartSerpApiConnectionStatusForUser } from "@/lib/ecomviper/walmart/walmart-serpapi-connection";
import { normalizeWalmartDraftsForEditor } from "@/lib/ecomviper/walmart/walmart-product-editor-hardening";
import { hydrateCurrentWalmartState } from "@/lib/ecomviper/walmart/walmart-native-state";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import type { WalmartDraftRecord } from "@/lib/ecomviper/walmart/walmart-types";
import type { WalmartNativeState } from "@/lib/ecomviper/walmart/walmart-native-state";

export const dynamic = "force-dynamic";

export default async function WalmartProductEditorPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const normalizedRequestedSku = typeof sku === "string" ? sku.trim().toUpperCase() : "";
  let product = null;
  let stagedDrafts: WalmartDraftRecord[] = [];
  let aiProviderConnected = false;
  let serpApiProviderConnected = false;
  let hydratedCurrentWalmartState: WalmartNativeState | null = null;
  let wasRemovedLocally = false;

  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (!unauthorizedResponse && userId) {
      product = await getWalmartProductBySkuForUser(userId, sku);
      if (!product) {
        wasRemovedLocally = await isWalmartProductArchivedForUser(userId, sku);
      }
      const allDrafts = await listWalmartDraftsForUser(userId);
      const normalizedDrafts = normalizeWalmartDraftsForEditor(allDrafts);
      stagedDrafts = normalizedDrafts.drafts.filter(
        (entry) =>
          typeof entry?.sku === "string" &&
          entry.sku.trim().toUpperCase() === normalizedRequestedSku
      );
      if (
        normalizedDrafts.diagnostics.repairedCount > 0 ||
        normalizedDrafts.diagnostics.droppedCount > 0
      ) {
        console.warn("[ecomviper:walmart:product-editor] normalized legacy staged drafts", {
          sku: normalizedRequestedSku || "unknown",
          repairedCount: normalizedDrafts.diagnostics.repairedCount,
          droppedCount: normalizedDrafts.diagnostics.droppedCount,
          warnings: normalizedDrafts.diagnostics.warnings.slice(0, 5),
        });
      }
      const openAiStatus = await getWalmartOpenAiConnectionStatusForUser(userId);
      aiProviderConnected = openAiStatus.connected;
      const serpApiStatus = await getWalmartSerpApiConnectionStatusForUser(userId);
      serpApiProviderConnected = serpApiStatus.connected;
      if (product) {
        hydratedCurrentWalmartState = hydrateCurrentWalmartState({
          product,
        });
      }
    }
  } catch {
    aiProviderConnected = false;
    serpApiProviderConnected = false;
    hydratedCurrentWalmartState = null;
  }

  if (!product) {
    return (
      <div className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h1 className="text-xl font-semibold text-[#0F172A]">Product not found</h1>
        <p className="mt-2 text-sm text-[#475569]">
          {wasRemovedLocally
            ? `SKU ${sku} was removed from your local EcomViper catalog.`
            : `Could not find SKU ${sku} in the current workspace.`}
        </p>
      </div>
    );
  }

  return (
    <ProductEditorClient
      product={product}
      stagedDrafts={stagedDrafts}
      aiProviderConnected={aiProviderConnected}
      serpApiProviderConnected={serpApiProviderConnected}
      hydratedCurrentWalmartState={hydratedCurrentWalmartState ?? undefined}
    />
  );
}
