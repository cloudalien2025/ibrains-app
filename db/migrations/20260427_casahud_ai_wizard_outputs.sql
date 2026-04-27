CREATE TABLE IF NOT EXISTS casahud_run_outputs (
  run_id text PRIMARY KEY REFERENCES casahud_generation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  output_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS casahud_run_outputs_user_updated_idx
  ON casahud_run_outputs (user_id, updated_at DESC);
