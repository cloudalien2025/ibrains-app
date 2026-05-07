import WalmartAiOptimizerClient from "@/app/apps/ecomviper/walmart/ai-optimizer/ai-optimizer-client";
import { buildDeterministicAiSuggestion } from "@/lib/ecomviper/walmart/walmart-ai-optimizer";
import { getWalmartRuntimeMode, listMockProducts } from "@/lib/ecomviper/walmart/walmart-mock-data";

export const dynamic = "force-dynamic";

export default function WalmartAiOptimizerPage() {
  const products = listMockProducts();
  const suggestions = products.map((product) => buildDeterministicAiSuggestion(product));

  return <WalmartAiOptimizerClient products={products} suggestions={suggestions} mode={getWalmartRuntimeMode()} />;
}
