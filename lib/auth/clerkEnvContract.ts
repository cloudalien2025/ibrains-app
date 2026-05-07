export const DEV_PUBLISHABLE_KEY_FALLBACK = "pk_test_ibrains_missing_publishable_key";

type ClerkContractEnv = {
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL?: string;
  NEXT_PUBLIC_CLERK_SIGN_IN_URL?: string;
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL?: string;
  NEXT_PUBLIC_CLERK_SIGN_UP_URL?: string;
  NODE_ENV?: string;
  VITEST?: string;
};

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function ensureLeadingSlash(pathValue: string | undefined, fallback: string): string {
  if (!isNonEmpty(pathValue)) return fallback;
  return pathValue.startsWith("/") ? pathValue : `/${pathValue}`;
}

export function resolveClerkRouteContract(env: ClerkContractEnv = process.env) {
  return {
    signInUrl: ensureLeadingSlash(env.NEXT_PUBLIC_CLERK_SIGN_IN_URL, "/sign-in"),
    signUpUrl: ensureLeadingSlash(env.NEXT_PUBLIC_CLERK_SIGN_UP_URL, "/sign-up"),
    signInFallbackRedirectUrl: ensureLeadingSlash(env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL, "/apps"),
    signUpFallbackRedirectUrl: ensureLeadingSlash(env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL, "/apps"),
  };
}

export function resolveClerkRuntimeContract(env: ClerkContractEnv = process.env) {
  const publishableKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || env.CLERK_PUBLISHABLE_KEY;
  const hasPublishableKey = isNonEmpty(publishableKey);
  const hasSecretKey = isNonEmpty(env.CLERK_SECRET_KEY);
  const isTestLike = env.NODE_ENV === "test" || env.VITEST === "true";
  const isProduction = env.NODE_ENV === "production";
  const hasProductionConfigError = isProduction && (!hasPublishableKey || !hasSecretKey);
  const effectivePublishableKey = hasPublishableKey
    ? publishableKey
    : isProduction
      ? undefined
      : DEV_PUBLISHABLE_KEY_FALLBACK;
  const configuredForProxy = (hasPublishableKey && hasSecretKey) || isTestLike;
  const missingVars = [
    !hasPublishableKey ? "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or CLERK_PUBLISHABLE_KEY" : null,
    !hasSecretKey ? "CLERK_SECRET_KEY" : null,
  ].filter((value): value is string => value !== null);

  return {
    configuredForProxy,
    effectivePublishableKey,
    hasProductionConfigError,
    isProduction,
    isTestLike,
    missingVars,
    publishableKey,
  };
}

export function buildClerkProductionConfigError(contract: ReturnType<typeof resolveClerkRuntimeContract>): string {
  return `Clerk auth misconfiguration in production: missing ${contract.missingVars.join(
    ", "
  )}. Refresh/session behavior will be invalid until runtime env values are fixed.`;
}
