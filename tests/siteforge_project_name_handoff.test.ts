import { describe, expect, it } from "vitest";
import { shouldTriggerProjectNameHandoff } from "@/lib/siteforge/projectNameHandoff";

describe("siteforge project name handoff trigger", () => {
  it("triggers only for active newly-created project with enabled input", () => {
    expect(
      shouldTriggerProjectNameHandoff({
        pendingCreatedProjectId: "p1",
        activeProjectId: "p1",
        inputDisabled: false,
      })
    ).toBe(true);
  });

  it("does not trigger when project switch/restore ids do not match", () => {
    expect(
      shouldTriggerProjectNameHandoff({
        pendingCreatedProjectId: "p1",
        activeProjectId: "p2",
        inputDisabled: false,
      })
    ).toBe(false);
  });

  it("does not trigger when no create signal or when input disabled", () => {
    expect(
      shouldTriggerProjectNameHandoff({
        pendingCreatedProjectId: null,
        activeProjectId: "p1",
        inputDisabled: false,
      })
    ).toBe(false);

    expect(
      shouldTriggerProjectNameHandoff({
        pendingCreatedProjectId: "p1",
        activeProjectId: "p1",
        inputDisabled: true,
      })
    ).toBe(false);
  });
});
