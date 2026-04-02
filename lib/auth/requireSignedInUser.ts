import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

type RequireSignedInUserResult = {
  userId: string | null;
  unauthorizedResponse: NextResponse | null;
};

export async function requireSignedInUser(): Promise<RequireSignedInUserResult> {
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
