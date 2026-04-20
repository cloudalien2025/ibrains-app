import { createHash } from "node:crypto";
import { ThriveNativeOperation } from "@/lib/siteforge/contracts";

export type ThriveNativeObjectType = "thrive_template" | "thrive_section" | "tcb_symbol" | "attachment";

export type ThriveNativeContractDefinition = {
  operation: ThriveNativeOperation;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  objectType: ThriveNativeObjectType;
  requiredPayloadFields: string[];
  expectedResponseFields: string[];
  verification: {
    type: "response_fields" | "read_back" | "logical";
    expected: string[];
  };
  rollback: {
    supported: boolean;
    method: "DELETE" | null;
    endpointTemplate: string | null;
  };
  allowedEnvironments: Array<"test" | "development">;
  fingerprint: "sha256_json";
};

function stableStringify(value: unknown): string {
  if (value == null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  const rec = value as Record<string, unknown>;
  const keys = Object.keys(rec).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(rec[key])}`).join(",")}}`;
}

export function fingerprintNativePayload(payload: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex").slice(0, 20);
}

export function validatePayloadRequiredFields(payload: Record<string, unknown>, fields: string[]): {
  ok: boolean;
  missing: string[];
} {
  const missing = fields.filter((field) => payload[field] == null || payload[field] === "");
  return { ok: missing.length === 0, missing };
}

export function validateResponseShape(response: Record<string, unknown> | null, expectedFields: string[]): boolean {
  if (!response) return false;
  return expectedFields.every((field) => response[field] != null);
}

export const THRIVE_NATIVE_CONTRACT_REGISTRY: Record<ThriveNativeOperation, ThriveNativeContractDefinition> = {
  assignTemplateToPost: {
    operation: "assignTemplateToPost",
    endpoint: "/wp-json/wp/v2/pages/{postId}",
    method: "POST",
    objectType: "attachment",
    requiredPayloadFields: ["postId", "templateId"],
    expectedResponseFields: ["id"],
    verification: { type: "response_fields", expected: ["id"] },
    rollback: { supported: false, method: null, endpointTemplate: null },
    allowedEnvironments: ["test", "development"],
    fingerprint: "sha256_json",
  },
  createOrUpdateSymbol: {
    operation: "createOrUpdateSymbol",
    endpoint: "/wp-json/wp/v2/tcb_symbol/{symbolId?}",
    method: "POST",
    objectType: "tcb_symbol",
    requiredPayloadFields: ["title", "slug"],
    expectedResponseFields: ["id", "slug"],
    verification: { type: "read_back", expected: ["id", "slug"] },
    rollback: { supported: true, method: "DELETE", endpointTemplate: "/wp-json/wp/v2/tcb_symbol/{id}" },
    allowedEnvironments: ["test", "development"],
    fingerprint: "sha256_json",
  },
  createOrUpdateSection: {
    operation: "createOrUpdateSection",
    endpoint: "/wp-json/wp/v2/thrive_section/{sectionId?}",
    method: "POST",
    objectType: "thrive_section",
    requiredPayloadFields: ["title", "slug"],
    expectedResponseFields: ["id", "slug"],
    verification: { type: "read_back", expected: ["id", "slug"] },
    rollback: { supported: true, method: "DELETE", endpointTemplate: "/wp-json/wp/v2/thrive_section/{id}" },
    allowedEnvironments: ["test", "development"],
    fingerprint: "sha256_json",
  },
  createOrUpdateTemplateShellReference: {
    operation: "createOrUpdateTemplateShellReference",
    endpoint: "/wp-json/wp/v2/thrive_template/{templateId?}",
    method: "POST",
    objectType: "thrive_template",
    requiredPayloadFields: ["title", "slug", "shellLayoutCandidate"],
    expectedResponseFields: ["id", "slug"],
    verification: { type: "read_back", expected: ["id", "slug"] },
    rollback: { supported: true, method: "DELETE", endpointTemplate: "/wp-json/wp/v2/thrive_template/{id}" },
    allowedEnvironments: ["test", "development"],
    fingerprint: "sha256_json",
  },
  attachReusablePrimitiveToPagePlan: {
    operation: "attachReusablePrimitiveToPagePlan",
    endpoint: "logical:attach_reusable_primitive",
    method: "POST",
    objectType: "attachment",
    requiredPayloadFields: ["postId", "primitiveId", "primitiveType"],
    expectedResponseFields: ["attached"],
    verification: { type: "logical", expected: ["attached"] },
    rollback: { supported: false, method: null, endpointTemplate: null },
    allowedEnvironments: ["test", "development"],
    fingerprint: "sha256_json",
  },
  importArchitectContentArtifact: {
    operation: "importArchitectContentArtifact",
    endpoint: "artifact:architect_import",
    method: "POST",
    objectType: "attachment",
    requiredPayloadFields: ["artifactRef"],
    expectedResponseFields: ["accepted"],
    verification: { type: "logical", expected: ["accepted"] },
    rollback: { supported: false, method: null, endpointTemplate: null },
    allowedEnvironments: ["test", "development"],
    fingerprint: "sha256_json",
  },
  importThemeBuilderArtifact: {
    operation: "importThemeBuilderArtifact",
    endpoint: "artifact:theme_builder_import",
    method: "POST",
    objectType: "attachment",
    requiredPayloadFields: ["artifactRef"],
    expectedResponseFields: ["accepted"],
    verification: { type: "logical", expected: ["accepted"] },
    rollback: { supported: false, method: null, endpointTemplate: null },
    allowedEnvironments: ["test", "development"],
    fingerprint: "sha256_json",
  },
};

export function getNativeContract(operation: ThriveNativeOperation): ThriveNativeContractDefinition | null {
  return THRIVE_NATIVE_CONTRACT_REGISTRY[operation] ?? null;
}
