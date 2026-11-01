DROP INDEX IF EXISTS idx_channels_one_system_per_server;
ALTER TABLE channels DROP COLUMN IF EXISTS is_system;
