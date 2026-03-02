import { BrainId } from "@/lib/brains/brainCatalog";

type HeaderLike = {
  get(name: string): string | null;
};

export type EntitledUser = {
  id: string;
  entitlements: Set<BrainId>;
};

export function resolveUserFromHeaders(headers: HeaderLike): EntitledUser {
  const userId = headers.get("x-user-id") ?? "anonymous";
  const entitlementHeader = headers.get("x-entitlements") ?? "";
  const values = entitlementHeader
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is BrainId => item === "directoryiq" || item === "ecomviper" || item === "studio");

  return {
    id: userId,
    entitlements: new Set(values),
  };
}

export function isEntitled(user: EntitledUser, brainId: BrainId): boolean {
  return user.entitlements.has(brainId);
}
