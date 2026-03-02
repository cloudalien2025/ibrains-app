export async function exchangeShopifyCode(): Promise<{ ok: boolean }> {
  return { ok: true };
}

export async function getShopifyShop(): Promise<{ shop: string }> {
  return { shop: "mock-shop" };
}
