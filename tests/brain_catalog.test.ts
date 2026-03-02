import { describe, expect, it } from "vitest";
import { brainCatalog, brainRoute } from "../lib/brains/brainCatalog";

describe("brain catalog", () => {
  it("exposes exactly the three launcher brains", () => {
    expect(brainCatalog).toHaveLength(3);
    expect(brainCatalog.map((brain) => brain.id)).toEqual(["directoryiq", "ecomviper", "studio"]);
  });

  it("derives open routes as /{brain_id}", () => {
    const routes = brainCatalog.map((brain) => brainRoute(brain.id));
    expect(routes).toEqual(["/directoryiq", "/ecomviper", "/studio"]);
  });
});
