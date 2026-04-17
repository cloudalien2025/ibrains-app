export type ProjectNameSaveState = "idle" | "saving" | "saved" | "error";

export function shouldPersistProjectName(params: {
  selectedProjectId: string;
  projectName: string;
  persistedProjectName: string;
}): boolean {
  if (!params.selectedProjectId) return false;
  const next = params.projectName.trim();
  if (!next) return false;
  return next !== params.persistedProjectName.trim();
}
