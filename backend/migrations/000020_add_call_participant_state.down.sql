ALTER TABLE call_participants
  DROP COLUMN IF EXISTS screen_sharing,
  DROP COLUMN IF EXISTS deafened,
  DROP COLUMN IF EXISTS muted;
