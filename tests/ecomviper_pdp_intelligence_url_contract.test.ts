import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("ecomviper PDP intelligence URL contract", () => {
  it("uses relative client fetch and avoids localhost https proxy targets", () => {
    const clientPath = path.join(
      process.cwd(),
      "app/ecomviper/products/[productId-or-handle]/product-editor-client.tsx"
    );
    const routePath = path.join(process.cwd(), "app/api/ecomviper/pdp-intelligence/route.ts");
    const proxyPath = path.join(process.cwd(), "proxy.ts");

    const clientSource = fs.readFileSync(clientPath, "utf8");
    const routeSource = fs.readFileSync(routePath, "utf8");
    const proxySource = fs.readFileSync(proxyPath, "utf8");

    expect(clientSource).toContain('fetch("/api/ecomviper/pdp-intelligence"');
    expect(clientSource).not.toContain("https://localhost:3001/api/ecomviper/pdp-intelligence");
    expect(clientSource).not.toContain("http://localhost:3001/api/ecomviper/pdp-intelligence");
    expect(routeSource).not.toContain("https://localhost:3001/api/ecomviper/pdp-intelligence");
    expect(proxySource).not.toContain("pathname === \"/api/ecomviper/pdp-intelligence\"");
  });
});
