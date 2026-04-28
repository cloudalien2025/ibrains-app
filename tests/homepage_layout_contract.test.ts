import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("homepage layout contract", () => {
  it("keeps hero, cards, delegated health details, and footer in a balanced top-level shell", () => {
    const pageSource = fs.readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8");
    const healthSource = fs.readFileSync(path.join(process.cwd(), "components/frontdoor/homepage-health-panel.tsx"), "utf8");

    expect(pageSource.includes("Platform Intelligence Engine")).toBe(true);
    expect(pageSource.includes("<h1 className=\"text-4xl font-semibold tracking-tight text-[#0F172A]\">iBrains</h1>")).toBe(true);
    expect(pageSource.includes("DirectoryIQ + SiteForge")).toBe(true);
    expect(pageSource.includes("HomepageHealthPanel")).toBe(true);
    expect(healthSource.includes("<div className=\"text-xs text-[#64748B]\">API</div>")).toBe(true);
    expect(healthSource.includes("<div className=\"text-xs text-[#64748B]\">Actions</div>")).toBe(true);
    expect(healthSource.includes("Raw Health JSON")).toBe(true);
    expect(pageSource.includes("© iBrains")).toBe(true);
    expect(pageSource.includes("sm:grid-cols-2 lg:grid-cols-3")).toBe(true);

    const heroIndex = pageSource.indexOf(">iBrains</h1>");
    const appsIndex = pageSource.indexOf("DirectoryIQ + SiteForge");
    const healthPanelIndex = pageSource.lastIndexOf("<HomepageHealthPanel workerUrl={workerUrl} />");
    const footerIndex = pageSource.indexOf("© iBrains");

    expect(heroIndex).toBeGreaterThan(-1);
    expect(appsIndex).toBeGreaterThan(heroIndex);
    expect(healthPanelIndex).toBeGreaterThan(appsIndex);
    expect(footerIndex).toBeGreaterThan(healthPanelIndex);
  });
});
