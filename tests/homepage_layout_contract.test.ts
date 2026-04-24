import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("homepage layout contract", () => {
  it("keeps hero, cards, health details, and footer in a balanced top-level shell", () => {
    const sourcePath = path.join(process.cwd(), "app/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Platform Intelligence Engine")).toBe(true);
    expect(source.includes("<h1 className=\"text-4xl font-semibold tracking-tight text-[#0F172A]\">iBrains</h1>")).toBe(true);
    expect(source.includes("DirectoryIQ + SiteForge")).toBe(true);
    expect(source.includes("<div className=\"text-xs text-[#64748B]\">API</div>")).toBe(true);
    expect(source.includes("<div className=\"text-xs text-[#64748B]\">Actions</div>")).toBe(true);
    expect(source.includes("Raw Health JSON")).toBe(true);
    expect(source.includes("© iBrains")).toBe(true);
    expect(source.includes("sm:grid-cols-2 lg:grid-cols-3")).toBe(true);

    const heroIndex = source.indexOf(">iBrains</h1>");
    const appsIndex = source.indexOf("DirectoryIQ + SiteForge");
    const apiIndex = source.indexOf("<div className=\"text-xs text-[#64748B]\">API</div>");
    const actionsIndex = source.indexOf("<div className=\"text-xs text-[#64748B]\">Actions</div>");
    const detailsIndex = source.indexOf("Raw Health JSON");
    const footerIndex = source.indexOf("© iBrains");

    expect(heroIndex).toBeGreaterThan(-1);
    expect(appsIndex).toBeGreaterThan(heroIndex);
    expect(apiIndex).toBeGreaterThan(appsIndex);
    expect(actionsIndex).toBeGreaterThan(apiIndex);
    expect(detailsIndex).toBeGreaterThan(actionsIndex);
    expect(footerIndex).toBeGreaterThan(detailsIndex);
  });
});
