import {
  BuildDelta,
  BuildSpec,
  QAResult,
  RevisionExecutionResult,
  RevisionOperation,
  RevisionRequest,
} from "@/lib/siteforge/contracts";
import { runQaAgent } from "@/lib/siteforge/agents/qa";

function deriveOperations(request: RevisionRequest): RevisionOperation[] {
  const text = request.message.toLowerCase();
  const ops: RevisionOperation[] = [];

  if (/premium|luxury|high-end/.test(text)) {
    ops.push({
      pageSlug: "home",
      operation: "adjust_tone",
      instructions: "Rewrite homepage copy to sound premium and outcome-focused.",
    });
  }

  if (/lead magnet|ebook|guide|checklist/.test(text)) {
    ops.push({
      pageSlug: "home",
      sectionType: "cta",
      operation: "append_section",
      instructions: "Add a lead magnet section with opt-in call to action.",
    });
  }

  if (/testimonial/.test(text)) {
    ops.push({
      pageSlug: "home",
      sectionType: "testimonials",
      operation: "append_section",
      instructions: "Add social proof testimonials section.",
    });
  }

  if (/rewrite homepage|homepage/.test(text)) {
    ops.push({
      pageSlug: "home",
      operation: "rewrite_page",
      instructions: "Rewrite all homepage body copy with stronger conversion clarity.",
    });
  }

  if (!ops.length) {
    ops.push({
      pageSlug: "home",
      operation: "replace_text",
      instructions: `Apply requested refinement: ${request.message}`,
    });
  }

  return ops;
}

function rewriteBody(body: string, instructions: string): string {
  return `${body}\n\nRefinement applied: ${instructions}`;
}

export function createBuildDelta(request: RevisionRequest): BuildDelta {
  const operations = deriveOperations(request);
  return {
    summary: `Revision with ${operations.length} targeted change(s).`,
    operations,
  };
}

export function applyBuildDelta(spec: BuildSpec, delta: BuildDelta): BuildSpec {
  const byPage = new Map(delta.operations.map((op) => [op.pageSlug, op]));

  return {
    ...spec,
    pages: spec.pages.map((page) => {
      const op = byPage.get(page.slug);
      if (!op) return page;

      if (op.operation === "rewrite_page") {
        return {
          ...page,
          sections: page.sections.map((section) => ({
            ...section,
            body: rewriteBody(section.body, op.instructions),
          })),
        };
      }

      if (op.operation === "append_section" && op.sectionType) {
        return {
          ...page,
          sections: [
            ...page.sections,
            {
              id: `${page.pageId}_rev_${page.sections.length + 1}`,
              type: op.sectionType,
              heading: "New Conversion Section",
              body: op.instructions,
              metadata: { source: "revision" },
            },
          ],
        };
      }

      return {
        ...page,
        sections: page.sections.map((section) => {
          if (op.sectionType && section.type !== op.sectionType) return section;
          return { ...section, body: rewriteBody(section.body, op.instructions) };
        }),
      };
    }),
  };
}

export function runRevisionQa(spec: BuildSpec): QAResult {
  return runQaAgent(spec);
}

export function toRevisionExecutionResult(params: {
  success: boolean;
  updatedPages: RevisionExecutionResult["updatedPages"];
  warnings: string[];
  errors: string[];
}): RevisionExecutionResult {
  return {
    success: params.success,
    updatedPages: params.updatedPages,
    warnings: params.warnings,
    errors: params.errors,
  };
}
