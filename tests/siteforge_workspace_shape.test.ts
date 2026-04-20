import { describe, expect, it } from "vitest";
import {
  normalizeProjectPayload,
  normalizeProjectsPayload,
  normalizeWorkspace,
  resolveInitialProjectId,
} from "@/lib/siteforge/workspaceShape";

describe("siteforge workspace shape normalization", () => {
  it("normalizes empty/partial project list payload safely", () => {
    const parsed = normalizeProjectsPayload({
      projects: [
        null,
        { id: "p1", name: "Project 1" },
        { id: "", name: "invalid" },
      ],
      lastOpenedProjectId: "ghost-id",
    });

    expect(parsed.projects).toHaveLength(1);
    expect(parsed.projects[0]?.id).toBe("p1");
    expect(resolveInitialProjectId(parsed.projects, parsed.lastOpenedProjectId)).toBe("p1");
  });

  it("normalizes partial workspace payload to safe defaults", () => {
    const workspace = normalizeWorkspace({
      project: {
        id: "p1",
        name: "My Project",
      },
      runHistory: [
        {
          id: "s1",
          projectId: "p1",
          runState: {},
        },
      ],
      runLogs: [{ logId: "l1", sessionId: "s1", stage: "invalid", message: 12 }],
      snapshot: {
        snapshotId: "snap1",
        projectId: "p1",
      },
    });

    expect(workspace).toBeTruthy();
    expect(workspace?.project.homepageStrategy).toBe("use_existing");
    expect(workspace?.runHistory[0]?.runState.currentStage).toBe("planning");
    expect(workspace?.runHistory[0]?.runState.timeline).toEqual([]);
    expect(workspace?.runLogs[0]?.stage).toBe("planning");
    expect(workspace?.snapshot?.knownPages).toEqual([]);
    expect(workspace?.snapshot?.thriveIntelligence).toBeNull();
    expect(workspace?.snapshot?.thriveNativeGuard).toBeNull();
    expect(workspace?.snapshot?.thriveNativeComposition).toBeNull();
    expect(workspace?.snapshot?.thriveNativeExecution).toBeNull();
    expect(workspace?.snapshot?.thriveNativeValidation).toBeNull();
  });

  it("normalizes project creation payload and rejects invalid shapes", () => {
    const ok = normalizeProjectPayload({ project: { id: "p2", name: "Created" } });
    expect(ok?.project.id).toBe("p2");

    const bad = normalizeProjectPayload({ project: { name: "Missing Id" } });
    expect(bad).toBeNull();
  });

  it("preserves visual composition metadata for section and native outcomes", () => {
    const workspace = normalizeWorkspace({
      project: { id: "p_visual", name: "Visual Project" },
      snapshot: {
        snapshotId: "snap_visual",
        projectId: "p_visual",
        thriveSectionResolutions: [
          {
            pageSlug: "home",
            sectionId: "s_hero",
            sectionType: "hero",
            sectionIntent: "conversion",
            symbolCandidateType: "header",
            preferredRenderTarget: "thrive_symbol_reference",
            resolution: "existing_symbol",
            visualPattern: "hero_split",
            selectedVisualPrimitive: "thrive_template_symbol",
            primitiveSelectionSource: "existing_reusable_symbol",
            designIntentSatisfied: true,
            fallbackReason: null,
            matchedSymbolId: 57,
            matchedSymbolTitle: "Header",
            matchedRole: "header",
            confidence: 0.9,
            reason: "match",
            rejectedReasons: [],
          },
        ],
        thriveNativeComposition: {
          mode: "thrive_native_staging_mode",
          sections: [
            {
              pageSlug: "home",
              sectionId: "s_cta",
              sectionType: "cta",
              intent: "created_visual_cta_block",
              selectedOperation: "createOrUpdateSection",
              targetObjectType: "thrive_section",
              matchedSymbolId: null,
              visualPattern: "cta_band",
              visualPrimitive: "thrive_call_to_action",
              designIntentSatisfied: true,
              fallbackReason: null,
              reason: "created",
            },
          ],
          operations: [],
          summary: {},
        },
      },
      runHistory: [],
      runLogs: [],
    });

    expect(workspace?.snapshot?.thriveSectionResolutions[0]?.visualPattern).toBe("hero_split");
    expect(workspace?.snapshot?.thriveSectionResolutions[0]?.selectedVisualPrimitive).toBe("thrive_template_symbol");
    expect(workspace?.snapshot?.thriveNativeComposition?.sections[0]?.intent).toBe("created_visual_cta_block");
  });
});
