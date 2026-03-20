ALTER TABLE directoryiq_authority_posts
  DROP CONSTRAINT IF EXISTS directoryiq_authority_posts_slot_index_check;

ALTER TABLE directoryiq_authority_posts
  ADD CONSTRAINT directoryiq_authority_posts_slot_index_check
  CHECK (slot_index >= 1 AND slot_index <= 5);
