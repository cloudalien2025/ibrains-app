import ProductEditorClient from "@/app/apps/ecomviper/walmart/products/[sku]/product-editor-client";
import { getWalmartProductBySku } from "@/lib/ecomviper/walmart/walmart-products";
import { getWalmartRuntimeMode } from "@/lib/ecomviper/walmart/walmart-mock-data";

export const dynamic = "force-dynamic";

export default async function WalmartProductEditorPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const product = getWalmartProductBySku(sku);

  if (!product) {
    return (
      <div className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h1 className="text-xl font-semibold text-[#0F172A]">Product not found</h1>
        <p className="mt-2 text-sm text-[#475569]">Could not find SKU {sku} in the current workspace.</p>
      </div>
    );
  }

  return <ProductEditorClient product={product} mode={getWalmartRuntimeMode()} />;
}
