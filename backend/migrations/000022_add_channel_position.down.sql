DROP INDEX IF EXISTS idx_channels_server_position;
ALTER TABLE channels DROP COLUMN IF EXISTS position;
