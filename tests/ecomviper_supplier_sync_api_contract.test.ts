import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("ecomviper supplier sync api contract", () => {
  it("exposes sync and status routes with auth protection and sync runner", () => {
    const syncRoute = fs.readFileSync(
      path.join(process.cwd(), "app/api/ecomviper/supplier-sources/sync/route.ts"),
      "utf8"
    );
    const statusRoute = fs.readFileSync(
      path.join(process.cwd(), "app/api/ecomviper/supplier-sources/status/route.ts"),
      "utf8"
    );

    expect(syncRoute).toContain("requireSignedInUser");
    expect(syncRoute).toContain("ECOMVIPER_SYNC_INTERNAL_TOKEN");
    expect(syncRoute).toContain("runRocktomicSourceSync");
    expect(syncRoute).toContain("POST");

    expect(statusRoute).toContain("requireSignedInUser");
    expect(statusRoute).toContain("getRocktomicSourceIngestionSnapshot");
    expect(statusRoute).toContain("allowRefresh: false");
    expect(statusRoute).toContain("triggerBackgroundRefresh: false");
  });
});
