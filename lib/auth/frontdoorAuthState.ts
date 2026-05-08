import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { resolveClerkRuntimeContract } from "@/lib/auth/clerkEnvContract";

export type FrontdoorAuthState =
  | {
      status: "signed-in";
      userId: string;
    }
  | {
      status: "signed-out";
    };

async function hasClerkSessionCookie(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    return Boolean(cookieStore.get("__session")?.value?.trim());
  } catch {
    return false;
  }
}

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

    if (await hasClerkSessionCookie()) {
      return {
        status: "signed-in",
        userId: "session_cookie",
      };
    }

    return { status: "signed-out" };
  } catch {
    if (await hasClerkSessionCookie()) {
      return {
        status: "signed-in",
        userId: "session_cookie",
      };
    }
    return { status: "signed-out" };
  }
}
