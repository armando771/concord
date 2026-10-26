ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_content_check;
ALTER TABLE messages ADD CONSTRAINT messages_content_check CHECK (char_length(content) >= 1 AND char_length(content) <= 4000);

DROP INDEX IF EXISTS idx_messages_sticker_id;
ALTER TABLE messages
    DROP COLUMN IF EXISTS gif_metadata,
    DROP COLUMN IF EXISTS gif_url,
    DROP COLUMN IF EXISTS sticker_id;
