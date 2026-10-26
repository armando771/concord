DROP INDEX IF EXISTS idx_messages_sticker_id;
ALTER TABLE messages
    DROP COLUMN IF EXISTS gif_metadata,
    DROP COLUMN IF EXISTS gif_url,
    DROP COLUMN IF EXISTS sticker_id;
