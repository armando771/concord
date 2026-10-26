ALTER TABLE users
  DROP COLUMN IF EXISTS allow_server_dms,
  DROP COLUMN IF EXISTS friend_request_policy;
