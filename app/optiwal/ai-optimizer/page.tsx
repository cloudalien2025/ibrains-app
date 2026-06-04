import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function WalmartAiOptimizerPage({
  searchParams,
}: {
  searchParams: Promise<{ sku?: string }>;
}) {
  const { sku } = await searchParams;
  const skuValue = typeof sku === "string" ? sku.trim() : "";
  if (skuValue) {
    redirect(`/optiwal/products/${encodeURIComponent(skuValue)}`);
  }
  redirect("/optiwal/products");
}
