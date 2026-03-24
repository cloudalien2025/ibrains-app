import crypto from "crypto";
import { NextResponse } from "next/server";

export type AuthorityErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "OPENAI_KEY_MISSING"
  | "OPENAI_AUTH"
  | "OPENAI_RATE_LIMIT"
  | "OPENAI_TIMEOUT"
  | "OPENAI_UPSTREAM"
  | "OPENAI_EMPTY_RESPONSE"
  | "DB_TIMEOUT"
  | "DB_CONNECTIVITY"
  | "NETWORK_CONNECTIVITY"
  | "APPROVAL_REQUIRED"
  | "TOKEN_INVALID"
  | "BD_NOT_CONFIGURED"
  | "BD_PUBLISH_FAILED"
  | "BD_LINK_ENFORCEMENT_FAILED"
  | "DRAFT_VALIDATION_FAILED"
  | "DRAFT_NOT_READY"
  | "STEP2_RESEARCH_REQUIRED"
  | "FAQ_PUBLISH_GATE_BLOCKED"
  | "INTERNAL_ERROR";

export type AuthorityErrorShape = {
  message: string;
  code: AuthorityErrorCode;
  reqId: string;
  details?: string;
};

export class AuthorityRouteError extends Error {
  readonly status: number;
  readonly code: AuthorityErrorCode;
  readonly details?: string;

  constructor(status: number, code: AuthorityErrorCode, message: string, details?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function authorityReqId(): string {
  return crypto.randomUUID();
}

export function logAuthorityInfo(input: {
  reqId: string;
  listingId: string;
  slot?: number;
  action: "draft" | "image" | "preview" | "publish";
  message: string;
}): void {
  const slotText = typeof input.slot === "number" ? ` slot=${input.slot}` : "";
  console.info(
    `[authority-support] listing=${input.listingId}${slotText} action=${input.action} reqId=${input.reqId} ${input.message}`
  );
}

export function logAuthorityError(input: {
  reqId: string;
  listingId: string;
  slot?: number;
  action: "draft" | "image" | "preview" | "publish";
  error: unknown;
}): void {
  const slotText = typeof input.slot === "number" ? ` slot=${input.slot}` : "";
  console.error(
    `[authority-support] listing=${input.listingId}${slotText} action=${input.action} reqId=${input.reqId} failed`,
    input.error
  );
}

export function toAuthorityError(
  error: unknown,
  fallback: { status: number; code: AuthorityErrorCode; message: string }
): { status: number; error: AuthorityErrorShape } {
  if (error instanceof AuthorityRouteError) {
    return {
      status: error.status,
      error: {
        message: error.message,
        code: error.code,
        reqId: "",
        details: error.details,
      },
    };
  }

  if (error instanceof Error) {
    return {
      status: fallback.status,
      error: {
        message: error.message || fallback.message,
        code: fallback.code,
        reqId: "",
      },
    };
  }

  return {
    status: fallback.status,
    error: {
      message: fallback.message,
      code: fallback.code,
      reqId: "",
    },
  };
}

export function authorityErrorResponse(params: {
  reqId: string;
  status: number;
  message: string;
  code: AuthorityErrorCode;
  details?: string;
}) {
  return NextResponse.json(
    {
      error: {
        message: params.message,
        code: params.code,
        reqId: params.reqId,
        details: params.details,
      },
    },
    { status: params.status }
  );
}
