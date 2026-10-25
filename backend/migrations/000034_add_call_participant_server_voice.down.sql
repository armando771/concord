ALTER TABLE call_participants
  DROP COLUMN IF EXISTS server_deafened,
  DROP COLUMN IF EXISTS server_muted;
