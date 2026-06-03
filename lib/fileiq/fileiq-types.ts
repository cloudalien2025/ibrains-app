import type {
  FileIqDownstreamBrain,
  FileIqExtractionJobStatus,
  FileIqReviewStatus,
  FileIqValidationStatus,
} from "@/lib/fileiq/fileiq-status";

export type FileIqJsonObject = Record<string, unknown>;

export type FileIqProvenanceRef = {
  sourceFileId?: string;
  sourceFileName?: string;
  sourcePage?: number;
  sourceSheet?: string;
  sourceRow?: number;
  sourceColumn?: string;
  sourceLink?: string;
  sourceIndex?: number;
  extractionMethod?: string;
  confidence?: number;
  validationStatus?: FileIqValidationStatus;
  reviewStatus?: FileIqReviewStatus;
  capturedAt?: string;
};

export interface FileIqSourceBundle {
  id: string;
  supplierId: string;
  name: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  metadata: FileIqJsonObject;
}

export interface FileIqSourceFile {
  id: string;
  bundleId: string;
  supplierId: string;
  fileName: string;
  fileType: string;
  sourceRole: string;
  storageUri: string;
  contentHash: string;
  status: string;
  metadata: FileIqJsonObject;
  createdAt: string;
}

export interface FileIqExtractionJob {
  id: string;
  bundleId: string;
  status: FileIqExtractionJobStatus;
  extractorType: string;
  /** Claude Agent SDK session id for this job; persisted for monitoring/retry. */
  agentSessionId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  summary: FileIqJsonObject;
}

export interface FileIqRawExtraction {
  id: string;
  extractionJobId: string;
  sourceFileId: string;
  artifactType: string;
  storageUri: string;
  payload: FileIqJsonObject;
  createdAt: string;
}

export interface FileIqCanonicalProduct {
  id: string;
  supplierId: string;
  canonicalSku: string;
  canonicalName: string;
  status: string;
  metadata: FileIqJsonObject;
  createdAt: string;
  updatedAt: string;
}

export interface FileIqProductFact {
  id: string;
  supplierId: string;
  sku: string;
  canonicalProductId: string;
  factType: string;
  factPayload: FileIqJsonObject;
  provenance: FileIqProvenanceRef;
  validationStatus: FileIqValidationStatus;
  confidence: number | null;
  reviewStatus: FileIqReviewStatus;
  sourceBundleId: string;
  packageVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileIqProductAsset {
  id: string;
  supplierId: string;
  sku: string;
  assetType: string;
  fileFormat: string;
  role: string;
  storageUri: string;
  previewUri: string | null;
  provenance: FileIqProvenanceRef;
  metadata: FileIqJsonObject;
  reviewStatus: FileIqReviewStatus;
}

export interface FileIqValidationReport {
  id: string;
  bundleId: string;
  extractionJobId: string | null;
  status: FileIqValidationStatus;
  summary: FileIqJsonObject;
  generatedAt: string;
}

export interface FileIqReviewItem {
  id: string;
  supplierId: string;
  sku: string;
  factId: string | null;
  assetId: string | null;
  reviewStatus: FileIqReviewStatus;
  reasonCode: string;
  details: FileIqJsonObject;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileIqPublishedPackage {
  id: string;
  bundleId: string;
  packageVersion: string;
  status: string;
  manifest: FileIqJsonObject;
  publishedBy: string;
  publishedAt: string;
}

export interface FileIqBrainOutput {
  id: string;
  downstreamBrain: FileIqDownstreamBrain;
  supplierId: string;
  sku: string;
  packageVersion: string;
  status: string;
  payload: FileIqJsonObject;
  producedAt: string;
}
