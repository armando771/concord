UPDATE roles SET permissions = permissions & ~201326592;

ALTER TABLE server_members DROP COLUMN IF EXISTS nickname;
