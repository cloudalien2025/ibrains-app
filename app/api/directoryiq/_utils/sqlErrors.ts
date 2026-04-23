type PgLikeError = Error & {
  code?: string;
};

export function isUndefinedRelationError(error: unknown, relationName: string): boolean {
  const relation = relationName.trim().toLowerCase();
  if (!relation) return false;
  if (!(error instanceof Error)) return false;

  const pgError = error as PgLikeError;
  if (pgError.code === "42P01") return true;

  const message = error.message.toLowerCase();
  if (!message.includes("does not exist")) return false;
  if (!message.includes("relation")) return false;

  return (
    message.includes(`relation "${relation}"`) ||
    message.includes(`relation "public.${relation}"`) ||
    message.includes(`relation '${relation}'`) ||
    message.includes(`relation 'public.${relation}'`)
  );
}

export function isRawRelationLeakMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return normalized.includes("relation \"") && normalized.includes("does not exist");
}
