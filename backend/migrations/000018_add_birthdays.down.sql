DROP TABLE IF EXISTS birthday_announcements;
ALTER TABLE messages DROP COLUMN IF EXISTS system_kind;
DROP INDEX IF EXISTS idx_users_birthday;
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_birthday_complete,
  DROP COLUMN IF EXISTS announce_birthday,
  DROP COLUMN IF EXISTS birthday_month,
  DROP COLUMN IF EXISTS birthday_day;
