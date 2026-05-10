import ProductEditorClient from "@/app/apps/ecomviper/walmart/products/[sku]/product-editor-client";
import { getWalmartProductBySkuForUser } from "@/lib/ecomviper/walmart/walmart-products";
import { listWalmartDraftsForUser } from "@/lib/ecomviper/walmart/walmart-drafts";
import { getWalmartOpenAiConnectionStatusForUser } from "@/lib/ecomviper/walmart/walmart-openai-connection";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import type { WalmartDraftRecord } from "@/lib/ecomviper/walmart/walmart-types";

export const dynamic = "force-dynamic";

export default async function WalmartProductEditorPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  let product = null;
  let stagedDrafts: WalmartDraftRecord[] = [];
  let aiProviderConnected = false;

  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (!unauthorizedResponse && userId) {
      product = await getWalmartProductBySkuForUser(userId, sku);
      const allDrafts = await listWalmartDraftsForUser(userId);
      stagedDrafts = allDrafts.filter(
        (entry) => entry.sku.trim().toUpperCase() === sku.trim().toUpperCase()
      );
      const openAiStatus = await getWalmartOpenAiConnectionStatusForUser(userId);
      aiProviderConnected = openAiStatus.connected;
    }
  } catch {
    aiProviderConnected = false;
  }

  if (!product) {
    return (
      <div className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h1 className="text-xl font-semibold text-[#0F172A]">Product not found</h1>
        <p className="mt-2 text-sm text-[#475569]">Could not find SKU {sku} in the current workspace.</p>
      </div>
    );
  }

  return <ProductEditorClient product={product} stagedDrafts={stagedDrafts} aiProviderConnected={aiProviderConnected} />;
}
