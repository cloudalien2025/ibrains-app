import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("DirectoryIQ schema parity", () => {
  it("keeps the settings and canonical signal-source tables in the tracked schema", () => {
    const schema = fs.readFileSync(
      path.join(process.cwd(), "db/directoryiq/001_directoryiq_schema_from_shared.sql"),
      "utf8"
    );

    expect(schema).toContain("CREATE TABLE IF NOT EXISTS public.directoryiq_settings");
    expect(schema).toContain("vertical_override text");
    expect(schema).toContain("risk_tier_overrides_json jsonb DEFAULT '{}'::jsonb NOT NULL");
    expect(schema).toContain("image_style_preference text DEFAULT 'editorial clean'::text NOT NULL");
    expect(schema).toContain("CREATE OR REPLACE FUNCTION public.directoryiq_ensure_constraint");
    expect(schema).toContain("SELECT public.directoryiq_ensure_constraint('public.directoryiq_settings', 'directoryiq_settings_pkey', 'PRIMARY KEY (user_id)');");

    expect(schema).toContain("CREATE TABLE IF NOT EXISTS public.directoryiq_signal_source_credentials");
    expect(schema).toContain("connector_id text NOT NULL");
    expect(schema).toContain("config_json jsonb DEFAULT '{}'::jsonb NOT NULL");
    expect(schema).toContain("SELECT public.directoryiq_ensure_constraint('public.directoryiq_signal_source_credentials', 'directoryiq_signal_source_credentials_user_id_connector_id_key', 'UNIQUE (user_id, connector_id)');");
  });

  it("applies and verifies the tracked DirectoryIQ schema during deployment", () => {
    const script = fs.readFileSync(path.join(process.cwd(), "scripts/apply_directoryiq_schema.sh"), "utf8");

    expect(script).toContain("DIRECTORYIQ_DATABASE_URL");
    expect(script).toContain("DATABASE_URL");
    expect(script).toContain("001_directoryiq_schema_from_shared.sql");
    expect(script).toContain("psql");
    expect(script).toContain("directoryiq_settings");
    expect(script).toContain("directoryiq_signal_source_credentials");
    expect(script).toContain("DirectoryIQ schema parity verified.");
  });
});
