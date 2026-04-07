export function resolveBrainId(input: string): string {
  const normalized = input.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (normalized === "directoryiq") return "brilliant_directories";
  if (normalized === "brilliant-directories") return "brilliant_directories";
  if (normalized === "ipetzo" || normalized === "i-petzo") return "ipetzo";
  return normalized || input;
}
