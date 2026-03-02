ALTER TABLE directoryiq_listing_upgrades
  ADD COLUMN IF NOT EXISTS bd_status TEXT;

ALTER TABLE directoryiq_listing_upgrades
  ADD COLUMN IF NOT EXISTS bd_response_excerpt TEXT;
