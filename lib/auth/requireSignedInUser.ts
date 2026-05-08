import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { hasClerkSessionCookie, resolveVerifiedClerkSessionUserId } from "@/lib/auth/clerkSessionToken";

type RequireSignedInUserResult = {
  userId: string | null;
  unauthorizedResponse: NextResponse | null;
};

export async function requireSignedInUser(): Promise<RequireSignedInUserResult> {
  if (process.env.E2E_MOCK_GRAPH === "1") {
    return { userId: "e2e-admin", unauthorizedResponse: null };
  }

  let userId: string | null = null;
  try {
    ({ userId } = await auth());
  } catch (error: unknown) {
    const verifiedUserId = await resolveVerifiedClerkSessionUserId();
    if (verifiedUserId) {
      return { userId: verifiedUserId, unauthorizedResponse: null };
    }

    if (await hasClerkSessionCookie()) {
      return {
        userId: null,
        unauthorizedResponse: NextResponse.json(
          {
            error: {
              code: "UNAUTHORIZED",
              message: "Sign-in required",
            },
          },
          { status: 401 }
        ),
      };
    }

    const message = error instanceof Error ? error.message : "Authentication unavailable.";
    return {
      userId: null,
      unauthorizedResponse: NextResponse.json(
        {
          error: {
            code: "AUTH_UNAVAILABLE",
            message,
          },
        },
        { status: 503 }
      ),
    };
  }

  if (!userId) {
    return {
      userId: null,
      unauthorizedResponse: NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Sign-in required",
          },
        },
        { status: 401 }
      ),
    };
  }

  return { userId, unauthorizedResponse: null };
}
