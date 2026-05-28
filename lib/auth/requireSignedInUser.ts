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
    const message = error instanceof Error ? error.message : "Authentication unavailable.";
    const isClerkMiddlewareDetectionError =
      message.includes("can't detect usage of clerkMiddleware") ||
      message.includes("auth-middleware");

    const verifiedUserId = await resolveVerifiedClerkSessionUserId();
    if (verifiedUserId) {
      return { userId: verifiedUserId, unauthorizedResponse: null };
    }

    // When Clerk reports missing middleware context for this route, treat as signed-out.
    if (isClerkMiddlewareDetectionError) {
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
