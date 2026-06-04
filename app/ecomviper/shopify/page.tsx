import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface ShopifyPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function getStringParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return getStringParam(value[0]);
  const normalized = (value || "").trim();
  return normalized || null;
}

export default async function EcomViperShopifyPage({ searchParams }: ShopifyPageProps) {
  const params = searchParams ? await searchParams : {};
  const demoParam = getStringParam(params.demo);

  if (demoParam) {
    redirect(`/ecomviper/settings?demo=${encodeURIComponent(demoParam)}`);
  }

  redirect("/ecomviper/settings");
}
