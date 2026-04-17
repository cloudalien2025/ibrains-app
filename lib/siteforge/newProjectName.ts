export function normalizeNewProjectName(value: string): string | null {
  const name = value.trim();
  return name ? name : null;
}
