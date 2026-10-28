UPDATE roles SET permissions = permissions & ~1073741824;
UPDATE channel_overwrites SET allow = allow & ~1073741824, deny = deny & ~1073741824;

ALTER TABLE messages DROP COLUMN IF EXISTS tts;
