import type { FileIqDownstreamBrain } from "@/lib/fileiq/fileiq-status";

export const fileIqPlannedTables = [
  "fileiq_source_bundles",
  "fileiq_source_files",
  "fileiq_extraction_jobs",
  "fileiq_raw_extractions",
  "fileiq_canonical_products",
  "fileiq_product_facts",
  "fileiq_product_assets",
  "fileiq_validation_reports",
  "fileiq_review_items",
  "fileiq_published_packages",
  "fileiq_brain_outputs",
] as const;

export type FileIqPlannedTable = (typeof fileIqPlannedTables)[number];

export type FileIqDatabaseBoundary = {
  sharedDatabaseEnvVar: "ECOMMERCE_DATABASE_URL";
  writeTables: readonly FileIqPlannedTable[];
  readContract: {
    latestApprovedFactsBy: readonly ["supplier", "sku", "product", "channel"];
    includeProvenance: true;
    includeValidationStatus: true;
  };
  downstreamBrains: readonly FileIqDownstreamBrain[];
  migrationState: "planning_only";
};

export const fileIqDatabaseBoundary: FileIqDatabaseBoundary = {
  sharedDatabaseEnvVar: "ECOMMERCE_DATABASE_URL",
  writeTables: fileIqPlannedTables,
  readContract: {
    latestApprovedFactsBy: ["supplier", "sku", "product", "channel"],
    includeProvenance: true,
    includeValidationStatus: true,
  },
  downstreamBrains: ["ecomviper", "optibay", "optiwal", "optipixel", "optizon"],
  migrationState: "planning_only",
};
