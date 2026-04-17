import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

type RequireSignedInUserResult = {
  userId: string | null;
  unauthorizedResponse: NextResponse | null;
};

export async function requireSignedInUser(): Promise<RequireSignedInUserResult> {
  if (process.env.E2E_MOCK_GRAPH === "1") {
    return { userId: "e2e-admin", unauthorizedResponse: null };
  }

  const { userId } = await auth();
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
