import { auth } from "@clerk/nextjs/server";
import { resolveClerkRuntimeContract } from "@/lib/auth/clerkEnvContract";

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
    if (!userId) {
      return { status: "signed-out" };
    }

    return {
      status: "signed-in",
      userId,
    };
  } catch {
    return { status: "signed-out" };
  }
}
