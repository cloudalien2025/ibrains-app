import EcomViperProductEditorClient from "@/app/ecomviper/products/[productId-or-handle]/product-editor-client";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { buildShopifyProductEditorStateForUser } from "@/lib/ecomviper/shopify/shopify-product-editor-state";

export const dynamic = "force-dynamic";

interface EcomViperProductEditorPageProps {
  params: Promise<{ "productId-or-handle": string }>;
}

export default async function EcomViperProductEditorPage({ params }: EcomViperProductEditorPageProps) {
  const resolvedParams = await params;
  const routeReference = (resolvedParams["productId-or-handle"] || "").trim();

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
    demoMode: false,
  });

  return <EcomViperProductEditorClient initialState={initialState} />;
}
