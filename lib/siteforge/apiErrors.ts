import { NextResponse } from "next/server";
import {
  isSiteForgePersistenceError,
  SITEFORGE_PERSISTENCE_UNAVAILABLE_CODE,
  SITEFORGE_PERSISTENCE_UNAVAILABLE_MESSAGE,
} from "@/lib/siteforge/repository/persistence";

export function siteForgePersistenceErrorResponse(error: unknown): NextResponse {
  if (isSiteForgePersistenceError(error)) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
        storage: error.storage,
      },
      { status: error.status }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: SITEFORGE_PERSISTENCE_UNAVAILABLE_CODE,
        message: SITEFORGE_PERSISTENCE_UNAVAILABLE_MESSAGE,
      },
    },
    { status: 503 }
  );
}

export function maybeSiteForgePersistenceErrorResponse(error: unknown): NextResponse | null {
  if (!isSiteForgePersistenceError(error)) return null;
  return siteForgePersistenceErrorResponse(error);
}
