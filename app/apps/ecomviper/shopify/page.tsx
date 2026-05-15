import ShopifyWorkspaceClient from "@/app/apps/ecomviper/shopify/shopify-workspace-client";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { buildShopifyAgenticWorkspaceStateForUser } from "@/lib/ecomviper/shopify/shopify-workspace-state";

export const dynamic = "force-dynamic";

interface ShopifyPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function isDemoEnabled(value: string | string[] | undefined): boolean {
  if (Array.isArray(value)) {
    return isDemoEnabled(value[0]);
  }
  const normalized = (value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "demo";
}

export default async function EcomViperShopifyPage({ searchParams }: ShopifyPageProps) {
  const params = searchParams ? await searchParams : {};
  const demoMode = isDemoEnabled(params.demo);

  let userId: string | null = null;
  try {
    const auth = await requireSignedInUser();
    if (!auth.unauthorizedResponse && auth.userId) {
      userId = auth.userId;
    }
  } catch {
    userId = null;
  }

  const workspaceState = await buildShopifyAgenticWorkspaceStateForUser({
    userId,
    demoMode,
  });

  return <ShopifyWorkspaceClient initialState={workspaceState} />;
}
