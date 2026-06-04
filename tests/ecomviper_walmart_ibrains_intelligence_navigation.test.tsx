import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import WalmartSidebar from "@/app/optiwal/_components/walmart-sidebar";
import { walmartNavItems } from "@/lib/ecomviper/walmart/walmart-nav";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/optiwal/ibrains-intelligence",
}));

describe("Walmart iBrains Intelligence navigation", () => {
  it("adds iBrains Intelligence nav item with expected route", () => {
    const entry = walmartNavItems.find((item) => item.label === "iBrains Intelligence");

    expect(entry).toBeDefined();
    expect(entry?.href).toBe("/optiwal/ibrains-intelligence");
  });

  it("renders sidebar link to iBrains Intelligence route", () => {
    const html = renderToStaticMarkup(<WalmartSidebar />);

    expect(html).toContain(">iBrains Intelligence<");
    expect(html).toContain('href="/optiwal/ibrains-intelligence"');
  });
});
