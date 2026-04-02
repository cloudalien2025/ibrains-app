BEGIN;

ALTER TABLE brain_chunk_taxonomy_assignments
  ADD COLUMN IF NOT EXISTS assignment_method TEXT NOT NULL DEFAULT 'legacy';

ALTER TABLE brain_chunk_taxonomy_assignments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_brain_chunk_taxonomy_assignments_chunk
  ON brain_chunk_taxonomy_assignments(brain_id, chunk_id, created_at DESC);

COMMIT;
