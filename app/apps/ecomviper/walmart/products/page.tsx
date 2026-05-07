import WalmartProductsClient from "@/app/apps/ecomviper/walmart/products/products-client";
import { listWalmartProducts } from "@/lib/ecomviper/walmart/walmart-products";
import { getWalmartRuntimeMode } from "@/lib/ecomviper/walmart/walmart-mock-data";

export const dynamic = "force-dynamic";

export default function WalmartProductsPage() {
  return <WalmartProductsClient products={listWalmartProducts()} mode={getWalmartRuntimeMode()} />;
}
