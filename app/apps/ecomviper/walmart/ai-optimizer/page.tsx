import WalmartAiOptimizerClient from "@/app/apps/ecomviper/walmart/ai-optimizer/ai-optimizer-client";
import { listWalmartProducts } from "@/lib/ecomviper/walmart/walmart-products";

export const dynamic = "force-dynamic";

export default function WalmartAiOptimizerPage() {
  const products = listWalmartProducts();
  return <WalmartAiOptimizerClient products={products} />;
}
