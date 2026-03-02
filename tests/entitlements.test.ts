import { describe, expect, it } from "vitest";
import { isAdminUser, resolveEntitledBrains, resolveUserFromHeaders } from "../lib/auth/entitlements";

describe("entitlements", () => {
  it("grants all brains to admin role users", () => {
    const entitled = resolveEntitledBrains({ role: "admin" });
    expect(entitled.has("directoryiq")).toBe(true);
    expect(entitled.has("ecomviper")).toBe(true);
    expect(entitled.has("studio")).toBe(true);
  });

  it("recognizes admin headers", () => {
    const user = resolveUserFromHeaders(
      new Headers({
        "x-user-role": "owner",
        "x-user-is-admin": "true",
      })
    );

    expect(isAdminUser(user)).toBe(true);
  });
});
