import crypto from "crypto";

export type UpgradeErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "OPENAI_KEY_MISSING"
  | "OPENAI_UPSTREAM"
  | "BD_NOT_CONFIGURED"
  | "PREVIEW_REQUIRED"
  | "TOKEN_INVALID"
  | "INTERNAL_ERROR";

export function upgradeReqId(): string {
  return crypto.randomUUID();
}

export function logUpgradeInfo(input: {
  reqId: string;
  listingId: string;
  action: "generate" | "preview" | "push";
  message: string;
}): void {
  console.info(`[directoryiq-upgrade] listing=${input.listingId} action=${input.action} reqId=${input.reqId} ${input.message}`);
}

export function logUpgradeError(input: {
  reqId: string;
  listingId: string;
  action: "generate" | "preview" | "push";
  error: unknown;
}): void {
  console.error(`[directoryiq-upgrade] listing=${input.listingId} action=${input.action} reqId=${input.reqId} failed`, input.error);
}

export function errorPayload(params: {
  status: number;
  reqId: string;
  message: string;
  code: UpgradeErrorCode;
  details?: string;
}): { status: number; body: { error: { message: string; code: UpgradeErrorCode; reqId: string; details?: string } } } {
  return {
    status: params.status,
    body: {
      error: {
        message: params.message,
        code: params.code,
        reqId: params.reqId,
        details: params.details,
      },
    },
  };
}
