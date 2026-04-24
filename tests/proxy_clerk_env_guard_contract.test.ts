import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("proxy clerk env guard contract", () => {
  it("uses shared clerk env contract and returns explicit production misconfiguration errors", () => {
    const sourcePath = path.join(process.cwd(), "proxy.ts");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("resolveClerkRuntimeContract")).toBe(true);
    expect(source.includes("buildClerkProductionConfigError")).toBe(true);
    expect(source.includes("if (clerkRuntimeContract.hasProductionConfigError)")).toBe(true);
    expect(source.includes("status: 503")).toBe(true);
    expect(source.includes("\"x-ibrains-auth-status\": \"misconfigured\"")).toBe(true);
    expect(source.includes("if (!isClerkConfigured)")).toBe(true);
    expect(source.includes("return NextResponse.redirect(new URL(\"/sign-in\", req.url));")).toBe(true);
    expect(source.includes("return await clerkProxy(req, event);")).toBe(true);
  });
});
