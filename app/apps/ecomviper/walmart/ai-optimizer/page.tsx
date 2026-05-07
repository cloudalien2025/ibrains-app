import WalmartAiOptimizerClient from "@/app/apps/ecomviper/walmart/ai-optimizer/ai-optimizer-client";
import { buildDeterministicAiSuggestion } from "@/lib/ecomviper/walmart/walmart-ai-optimizer";
import { listWalmartProducts } from "@/lib/ecomviper/walmart/walmart-products";

export const dynamic = "force-dynamic";

export default function WalmartAiOptimizerPage() {
  const products = listWalmartProducts();
  const suggestions = products.map((product) => buildDeterministicAiSuggestion(product));

  return <WalmartAiOptimizerClient products={products} suggestions={suggestions} />;
}
