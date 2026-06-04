import { verifyToken } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

const CLERK_SESSION_COOKIE_NAME = "__session";

function readSecretKey(): string | null {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  return secretKey ? secretKey : null;
}

export async function hasClerkSessionCookie(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    return Boolean(cookieStore.get(CLERK_SESSION_COOKIE_NAME)?.value?.trim());
  } catch {
    return false;
  }
}

export async function resolveVerifiedClerkSessionUserId(): Promise<string | null> {
  const secretKey = readSecretKey();
  if (!secretKey) return null;

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(CLERK_SESSION_COOKIE_NAME)?.value?.trim();
    if (!sessionToken) return null;

    const claims = await verifyToken(sessionToken, { secretKey });
    const subject = claims?.sub;
    if (typeof subject === "string" && subject.trim().length > 0) {
      return subject;
    }
    return null;
  } catch {
    return null;
  }
}
