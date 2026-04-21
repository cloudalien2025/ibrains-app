import { describe, expect, it } from "vitest";
import { getBuildDraftState, getSelectedPageApprovalState, normalizePageApprovalName } from "@/app/apps/siteforge/page";

describe("siteforge action guardrails", () => {
  it("blocks build draft with explicit blockers when prerequisites are missing", () => {
    const state = getBuildDraftState({
      projectSelected: false,
      isConnected: false,
      pageCount: 0,
      approvedPageCount: 0,
    });

    expect(state.canBuildDraft).toBe(false);
    expect(state.blockers).toEqual([
      "Select a project first.",
      "Validate your WordPress connection.",
      "Generate pages before publishing.",
      "Approve at least one page before building your draft.",
    ]);
  });

  it("allows build draft only when all prerequisites are satisfied", () => {
    const state = getBuildDraftState({
      projectSelected: true,
      isConnected: true,
      pageCount: 3,
      approvedPageCount: 1,
    });

    expect(state.canBuildDraft).toBe(true);
    expect(state.blockers).toEqual([]);
  });

  it("surfaces review empty/needs-selection/ready states with concrete labels", () => {
    expect(getSelectedPageApprovalState({ pageRows: [], selectedPage: null })).toEqual({
      kind: "empty",
      message: "No pages are ready for review yet.",
    });

    expect(
      getSelectedPageApprovalState({
        pageRows: [{ title: "Home" }],
        selectedPage: null,
      })
    ).toEqual({
      kind: "needs_selection",
      message: "Select a page to review.",
    });

    expect(
      getSelectedPageApprovalState({
        pageRows: [{ title: "Home" }],
        selectedPage: { title: "Home" },
      })
    ).toEqual({
      kind: "ready",
      buttonLabel: "Approve Homepage",
    });
  });

  it("normalizes page approval names for non-home pages", () => {
    expect(normalizePageApprovalName("About")).toBe("About Page");
    expect(normalizePageApprovalName("Contact Page")).toBe("Contact Page");
  });
});
