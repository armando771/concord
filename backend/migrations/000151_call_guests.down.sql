DROP TABLE IF EXISTS call_guest_passes;
DROP TABLE IF EXISTS call_guest_invites;
DELETE FROM users WHERE is_guest;
ALTER TABLE users DROP COLUMN IF EXISTS is_guest;
