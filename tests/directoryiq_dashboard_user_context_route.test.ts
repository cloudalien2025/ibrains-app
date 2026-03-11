import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

describe("directoryiq dashboard route user context", () => {
  it("uses canonical DirectoryIQ user context when only email header is present", async () => {
    process.env.DIRECTORYIQ_API_BASE = "http://127.0.0.1:3001";

    const { GET } = await import("@/app/api/directoryiq/dashboard/route");
    const req = new NextRequest("http://localhost/api/directoryiq/dashboard", {
      headers: {
        "x-user-email": "owner@app.ibrains.ai",
      },
    });

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.connected).toBe(true);
    expect(json.last_analyzed_at).not.toBeNull();
  });
});

