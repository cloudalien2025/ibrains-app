import WalmartAiOptimizerClient from "@/app/apps/ecomviper/walmart/ai-optimizer/ai-optimizer-client";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { listWalmartProductsForUser } from "@/lib/ecomviper/walmart/walmart-products";

export const dynamic = "force-dynamic";

export default async function WalmartAiOptimizerPage() {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  const products = !unauthorizedResponse && userId ? await listWalmartProductsForUser(userId) : [];
  return <WalmartAiOptimizerClient products={products} />;
}
