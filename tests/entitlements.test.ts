import { describe, expect, it } from "vitest";
import { isAdminUser, isEntitled, resolveUserFromHeaders } from "@/lib/auth/entitlements";

function makeHeaders(entries: Record<string, string | undefined>) {
  return {
    get(name: string) {
      const key = Object.keys(entries).find((entry) => entry.toLowerCase() === name.toLowerCase());
      return key ? entries[key] ?? null : null;
    },
  };
}

describe("entitlements header resolution", () => {
  it("preserves roles from x-user when role headers are missing", () => {
    const headers = makeHeaders({
      "x-user": JSON.stringify({ roles: ["owner"], email: "owner@example.com" }),
    });
    const user = resolveUserFromHeaders(headers);
    expect(isAdminUser(user)).toBe(true);
  });

  it("preserves entitlements from x-user when entitlement headers are missing", () => {
    const headers = makeHeaders({
      "x-user": JSON.stringify({ entitlements: ["directoryiq"] }),
    });
    const user = resolveUserFromHeaders(headers);
    expect(isEntitled(user, "directoryiq")).toBe(true);
  });

  it("treats cf-access authenticated email as admin for entitlements", () => {
    const headers = makeHeaders({
      "cf-access-authenticated-user-email": "owner@example.com",
    });
    const user = resolveUserFromHeaders(headers);
    expect(isAdminUser(user)).toBe(true);
    expect(isEntitled(user, "directoryiq")).toBe(true);
  });

  it("treats forwarded email as admin for entitlements", () => {
    const headers = makeHeaders({
      "x-forwarded-email": "owner@example.com",
    });
    const user = resolveUserFromHeaders(headers);
    expect(isAdminUser(user)).toBe(true);
    expect(isEntitled(user, "directoryiq")).toBe(true);
  });
});
