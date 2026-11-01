DROP TRIGGER IF EXISTS users_birthday_set_at ON users;
DROP FUNCTION IF EXISTS users_birthday_set_at();
ALTER TABLE users DROP COLUMN IF EXISTS birthday_set_at;
