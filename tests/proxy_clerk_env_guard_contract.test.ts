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
    expect(source.includes("function buildSignInRedirect(req: NextRequest): NextResponse")).toBe(true);
    expect(source.includes("signInUrl.searchParams.set(\"redirect_url\", redirectUrl)")).toBe(true);
    expect(source.includes("return buildSignInRedirect(req);")).toBe(true);
    expect(source.includes("return await clerkProxy(req, event);")).toBe(true);
  });

  it("does not enable Clerk frontend API proxying for the app.ibrains.ai allowed-subdomain model", () => {
    const sourcePath = path.join(process.cwd(), "proxy.ts");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("frontendApiProxy")).toBe(false);
    // __clerk requests must bypass middleware entirely so stale Clerk proxy-mode
    // browser traffic gets a clean Next.js 404 rather than Clerk middleware rewrite.
    expect(source.includes('"/(api|trpc|__clerk)(.*)"')).toBe(false);
    expect(source.includes('(?!_next|__clerk|')).toBe(true);
  });
});
