ALTER TABLE messages
    ADD COLUMN sticker_id UUID NULL REFERENCES server_stickers (id) ON DELETE SET NULL,
    ADD COLUMN gif_url VARCHAR(1024) NULL,
    ADD COLUMN gif_metadata JSONB NULL;

CREATE INDEX idx_messages_sticker_id ON messages (sticker_id) WHERE sticker_id IS NOT NULL;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_content_check;
ALTER TABLE messages ADD CONSTRAINT messages_content_check CHECK (char_length(content) <= 4000);
