import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge describe and connect contract", () => {
  it("uses one describe prompt and one plan action", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Describe the homepage and additional pages you want created.")).toBe(true);
    expect(source.includes("Create Website Plan")).toBe(true);
    expect(source.includes("Plan summary")).toBe(true);
    expect(source.includes("Approve Homepage")).toBe(false);
    expect(source.includes("Use this page set")).toBe(false);
    expect(source.includes("Use this CTA style")).toBe(false);
    expect(source.includes("Approve reuse decisions")).toBe(false);
    expect(
      source.includes(
        "Build a homepage for iPetzo that quickly builds trust with dog and cat owners, explains the app clearly, and pushes them to start a trial. Also create an About page, FAQ page, and Contact page."
      )
    ).toBe(true);
  });

  it("uses one connect moment with one primary action", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Connect Website")).toBe(true);
    expect(source.includes("WordPress URL")).toBe(true);
    expect(source.includes("App password")).toBe(true);
    expect(source.includes("OpenAI key")).toBe(true);
    expect(source.includes("SerpAPI key")).toBe(true);
    expect(source.includes("Save API Keys")).toBe(false);
    expect(source.includes("Validate Connection")).toBe(false);
  });
});
