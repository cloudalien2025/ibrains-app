import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("proxy clerk env guard contract", () => {
  it("guards middleware when clerk env is missing and redirects protected routes", () => {
    const sourcePath = path.join(process.cwd(), "proxy.ts");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("isClerkConfigured")).toBe(true);
    expect(source.includes("if (!isClerkConfigured)")).toBe(true);
    expect(source.includes("return NextResponse.redirect(new URL(\"/sign-in\", req.url));")).toBe(true);
    expect(source.includes("return await clerkProxy(req, event);")).toBe(true);
  });
});
