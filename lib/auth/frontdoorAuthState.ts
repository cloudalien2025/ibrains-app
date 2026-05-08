import { auth } from "@clerk/nextjs/server";
import { resolveClerkRuntimeContract } from "@/lib/auth/clerkEnvContract";
import { resolveVerifiedClerkSessionUserId } from "@/lib/auth/clerkSessionToken";

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

  try {
    const { userId } = await auth();
    if (userId) {
      return {
        status: "signed-in",
        userId,
      };
    }

    const verifiedUserId = await resolveVerifiedClerkSessionUserId();
    if (verifiedUserId) {
      return {
        status: "signed-in",
        userId: verifiedUserId,
      };
    }

    return { status: "signed-out" };
  } catch {
    const verifiedUserId = await resolveVerifiedClerkSessionUserId();
    if (verifiedUserId) {
      return {
        status: "signed-in",
        userId: verifiedUserId,
      };
    }
    return { status: "signed-out" };
  }
}
