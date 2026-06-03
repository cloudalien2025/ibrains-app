export const fileIqExtractionJobStatuses = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export type FileIqExtractionJobStatus = (typeof fileIqExtractionJobStatuses)[number];

export const fileIqValidationStatuses = [
  "valid",
  "partial",
  "visual_only",
  "missing",
  "conflict",
  "invalid",
  "needs_review",
] as const;

export type FileIqValidationStatus = (typeof fileIqValidationStatuses)[number];

export const fileIqReviewStatuses = [
  "unreviewed",
  "approved",
  "rejected",
  "needs_review",
] as const;

export type FileIqReviewStatus = (typeof fileIqReviewStatuses)[number];

export const fileIqDownstreamBrains = [
  "ecomviper",
  "optibay",
  "optiwal",
  "optipixel",
  "optizon",
] as const;

export type FileIqDownstreamBrain = (typeof fileIqDownstreamBrains)[number];

function includesStatus<T extends readonly string[]>(set: T, value: string): value is T[number] {
  return (set as readonly string[]).includes(value);
}

export function isFileIqExtractionJobStatus(value: string): value is FileIqExtractionJobStatus {
  return includesStatus(fileIqExtractionJobStatuses, value);
}

export function isFileIqValidationStatus(value: string): value is FileIqValidationStatus {
  return includesStatus(fileIqValidationStatuses, value);
}

export function isFileIqReviewStatus(value: string): value is FileIqReviewStatus {
  return includesStatus(fileIqReviewStatuses, value);
}

export function isFileIqDownstreamBrain(value: string): value is FileIqDownstreamBrain {
  return includesStatus(fileIqDownstreamBrains, value);
}
