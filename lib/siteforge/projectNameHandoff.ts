export function shouldTriggerProjectNameHandoff(params: {
  pendingCreatedProjectId: string | null;
  activeProjectId: string;
  inputDisabled: boolean;
}): boolean {
  if (!params.pendingCreatedProjectId) return false;
  if (params.pendingCreatedProjectId !== params.activeProjectId) return false;
  if (params.inputDisabled) return false;
  return true;
}
