import { type BrainId, brainIds, isBrainId } from "@/lib/brains/brainCatalog";

export type EntitlementUser = Record<string, unknown> | null | undefined;

const DEFAULT_ENTITLED_BRAINS = "ecomviper";
const ADMIN_ROLES = new Set(["admin", "owner", "superadmin", "super_admin", "workspace_admin"]);

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function extractStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : null))
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        return extractStringArray(parsed);
      } catch {
        return splitCsv(trimmed);
      }
    }
    return splitCsv(trimmed);
  }

  return [];
}

function normalizeBrainId(value: string): BrainId | null {
  const normalized = value.trim().toLowerCase();
  return isBrainId(normalized) ? normalized : null;
}

function toEntitlementSet(values: string[]): Set<BrainId> {
  const resolved = new Set<BrainId>();
  values.forEach((value) => {
    const brainId = normalizeBrainId(value);
    if (brainId) resolved.add(brainId);
  });
  return resolved;
}

function readClaims(user: EntitlementUser): string[] {
  if (!user || typeof user !== "object") return [];

  const keys: (keyof Record<string, unknown>)[] = [
    "brains",
    "entitlements",
    "features",
    "brain_entitlements",
    "brainIds",
  ];

  const direct = keys.flatMap((key) => extractStringArray(user[key]));
  const nestedUser = user.user && typeof user.user === "object" ? (user.user as Record<string, unknown>) : null;
  const nested = nestedUser ? keys.flatMap((key) => extractStringArray(nestedUser[key])) : [];

  return [...direct, ...nested];
}

function readRoles(user: EntitlementUser): string[] {
  if (!user || typeof user !== "object") return [];

  const roleKeys: (keyof Record<string, unknown>)[] = ["role", "roles", "user_role", "user_roles"];
  const direct = roleKeys.flatMap((key) => extractStringArray(user[key]));
  const nestedUser = user.user && typeof user.user === "object" ? (user.user as Record<string, unknown>) : null;
  const nested = nestedUser ? roleKeys.flatMap((key) => extractStringArray(nestedUser[key])) : [];

  return [...direct, ...nested];
}

function hasAdminFlag(user: EntitlementUser): boolean {
  if (!user || typeof user !== "object") return false;
  const fields = ["is_admin", "isAdmin", "admin"] as const;
  return fields.some((field) => user[field] === true);
}

export function isAdminUser(user?: EntitlementUser): boolean {
  if (!user) return false;
  if (hasAdminFlag(user)) return true;

  const roles = readRoles(user).map((role) => role.toLowerCase());
  return roles.some((role) => ADMIN_ROLES.has(role));
}

export function resolveDefaultEntitledBrains(): Set<BrainId> {
  const csv = process.env.IBRAINS_ENTITLED_BRAINS_DEFAULT?.trim() || DEFAULT_ENTITLED_BRAINS;
  return toEntitlementSet(splitCsv(csv));
}

export function resolveEntitledBrains(user?: EntitlementUser): Set<BrainId> {
  if (isAdminUser(user)) {
    return new Set(brainIds);
  }

  const fromClaims = toEntitlementSet(readClaims(user));
  return fromClaims.size > 0 ? fromClaims : resolveDefaultEntitledBrains();
}

export function isEntitled(user: EntitlementUser, brainId: BrainId): boolean {
  return resolveEntitledBrains(user).has(brainId);
}

function tryParseJsonObject(input: string | null): Record<string, unknown> | null {
  if (!input) return null;
  try {
    const parsed = JSON.parse(input) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
}

type HeaderReader = {
  get(name: string): string | null;
};

export function resolveUserFromHeaders(headers: HeaderReader): Record<string, unknown> {
  const parsedUser = tryParseJsonObject(headers.get("x-user"));
  const headerEntitlements = extractStringArray(headers.get("x-user-entitlements"));
  const headerFeatures = extractStringArray(headers.get("x-user-features"));
  const headerBrains = extractStringArray(headers.get("x-user-brains"));
  const headerRoles = extractStringArray(headers.get("x-user-roles"));
  const headerRole = headers.get("x-user-role");
  const isAdminHeader = headers.get("x-user-is-admin");
  const headerEmail =
    headers.get("x-user-email") ?? headers.get("x-forwarded-email") ?? headers.get("cf-access-authenticated-user-email");

  return {
    ...(parsedUser ?? {}),
    entitlements: headerEntitlements,
    features: headerFeatures,
    brains: headerBrains,
    roles: headerRole ? [...headerRoles, headerRole] : headerRoles,
    is_admin:
      isAdminHeader === "1" ||
      isAdminHeader?.toLowerCase() === "true" ||
      ((parsedUser?.is_admin as boolean | undefined) ?? false),
    email: headerEmail ?? (parsedUser?.email as string | undefined) ?? null,
    name: headers.get("x-user-name") ?? (parsedUser?.name as string | undefined) ?? "Operator",
  };
}

export function entitledBrainMap(user?: EntitlementUser): Record<BrainId, boolean> {
  const entitled = resolveEntitledBrains(user);
  return {
    directoryiq: entitled.has("directoryiq"),
    ecomviper: entitled.has("ecomviper"),
    studio: entitled.has("studio"),
  };
}

export function allBrainIds(): BrainId[] {
  return [...brainIds];
}
