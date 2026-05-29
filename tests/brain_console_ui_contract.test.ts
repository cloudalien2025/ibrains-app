import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("brain console ui contract", () => {
  it("keeps Back to Brains link canonical and scoped to /brains", () => {
    const linkSource = readSource("components/brains/back-to-brains-link.tsx");
    expect(linkSource).toContain('href="/brains"');
    expect(linkSource).toContain("Back to Brains");
  });

  it("wires Back to Brains into every canonical standalone brain console", () => {
    const filesUsingSharedBackLink = [
      "app/ecomviper/ecomviper-dashboard-client.tsx",
      "app/optibay/layout.tsx",
      "app/optiwal/layout.tsx",
      "app/optizon/page.tsx",
      "app/directoryiq/layout.tsx",
      "app/pagebolt/layout.tsx",
      "app/ipetzo/page.tsx",
      "app/casaflix/studio-casahud-command-center.tsx",
    ];

    for (const filePath of filesUsingSharedBackLink) {
      const source = readSource(filePath);
      expect(source).toContain("BackToBrainsLink");
    }

    const reelifySource = readSource("app/reelify/page.tsx");
    expect(reelifySource).toContain('import StudioDomaraClient from "@/app/casaflix/studio-domara-client"');
  });

  it("removes incorrect OptiBay/OptiWal/OptiZon parent-child back-link language", () => {
    const optiFiles = [
      "app/optibay/layout.tsx",
      "app/optiwal/layout.tsx",
      "app/optizon/page.tsx",
    ];

    for (const filePath of optiFiles) {
      const source = readSource(filePath);
      expect(source).not.toContain("Back to EcomViper");
      expect(source).not.toContain('href="/ecomviper"');
    }
  });

  it("renders EcomViper and iPetzo in standard sidebar/workspace shell structure", () => {
    const ecomSource = readSource("app/ecomviper/ecomviper-dashboard-client.tsx");
    expect(ecomSource).toContain('data-testid="ecomviper-brain-sidebar"');
    expect(ecomSource).toContain('data-testid="ecomviper-brain-workspace"');
    expect(ecomSource).toContain("BackToBrainsLink");
    expect(ecomSource).not.toContain("Open OptiWal");
    expect(ecomSource).not.toContain("Open OptiBay");
    expect(ecomSource).not.toContain("Open OptiZon");
    expect(ecomSource).not.toContain('href="/optiwal"');
    expect(ecomSource).not.toContain('href="/optibay"');
    expect(ecomSource).not.toContain('href="/optizon"');
    expect(ecomSource).toContain("BackToBrainsLink");

    const ipetzoSource = readSource("app/ipetzo/page.tsx");
    expect(ipetzoSource).toContain('data-testid="ipetzo-brain-sidebar"');
    expect(ipetzoSource).toContain('data-testid="ipetzo-brain-workspace"');
    expect(ipetzoSource).toContain("BackToBrainsLink");
  });

  it("keeps standalone brain route source free of /apps links", () => {
    const brainRouteSources = [
      "app/ecomviper/ecomviper-dashboard-client.tsx",
      "app/optibay/layout.tsx",
      "app/optiwal/layout.tsx",
      "app/optizon/page.tsx",
      "app/directoryiq/layout.tsx",
      "app/casaflix/studio-casahud-command-center.tsx",
      "app/pagebolt/layout.tsx",
      "app/reelify/page.tsx",
      "app/ipetzo/page.tsx",
    ].map(readSource);

    for (const source of brainRouteSources) {
      expect(source).not.toContain("/apps");
      expect(source).not.toContain("Back to Apps");
      expect(source).not.toContain("Open App");
    }
  });
});
