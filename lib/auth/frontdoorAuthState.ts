import { auth } from "@clerk/nextjs/server";
import { resolveClerkRuntimeContract } from "@/lib/auth/clerkEnvContract";
import { hasClerkSessionCookie, resolveVerifiedClerkSessionUserId } from "@/lib/auth/clerkSessionToken";

export type FrontdoorAuthState =
  | {
      status: "signed-in";
      userId: string;
    }
  | {
      status: "signed-out";
    };

export async function resolveFrontdoorAuthState(): Promise<FrontdoorAuthState> {
  if (process.env.E2E_MOCK_GRAPH === "1") {
    return {
      status: "signed-in",
      userId: "e2e-admin",
    };
  }

  const runtimeContract = resolveClerkRuntimeContract();
  if (!runtimeContract.configuredForProxy) {
    return { status: "signed-out" };
  }

  const hasSessionCookie = await hasClerkSessionCookie();
  if (!hasSessionCookie) {
    return { status: "signed-out" };
  }

  const verifiedUserId = await resolveVerifiedClerkSessionUserId();
  if (verifiedUserId) {
    return {
      status: "signed-in",
      userId: verifiedUserId,
    };
  }

  try {
    const { userId } = await auth();
    if (userId) {
      return {
        status: "signed-in",
        userId,
      };
    }
    return { status: "signed-out" };
  } catch {
    return { status: "signed-out" };
  }
}
