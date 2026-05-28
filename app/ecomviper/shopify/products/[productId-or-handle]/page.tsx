import ShopifyProductEditorClient from "@/app/ecomviper/shopify/products/[productId-or-handle]/shopify-product-editor-client";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { buildShopifyProductEditorStateForUser } from "@/lib/ecomviper/shopify/shopify-product-editor-state";

export const dynamic = "force-dynamic";

interface ShopifyProductEditorPageProps {
  params: Promise<{ "productId-or-handle": string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function isDemoEnabled(value: string | string[] | undefined): boolean {
  if (Array.isArray(value)) {
    return isDemoEnabled(value[0]);
  }
  const normalized = (value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "demo";
}

export default async function ShopifyProductEditorPage({
  params,
  searchParams,
}: ShopifyProductEditorPageProps) {
  const resolvedParams = await params;
  const routeReference = (resolvedParams["productId-or-handle"] || "").trim();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const demoMode = isDemoEnabled(resolvedSearchParams.demo);

  let userId: string | null = null;
  try {
    const auth = await requireSignedInUser();
    if (!auth.unauthorizedResponse && auth.userId) {
      userId = auth.userId;
    }
  } catch {
    userId = null;
  }

  const initialState = await buildShopifyProductEditorStateForUser({
    userId,
    productReference: routeReference,
    demoMode,
  });

  return <ShopifyProductEditorClient initialState={initialState} />;
}

