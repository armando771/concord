ALTER TABLE messages
    ADD COLUMN sticker_id UUID NULL REFERENCES server_stickers (id) ON DELETE SET NULL,
    ADD COLUMN gif_url VARCHAR(1024) NULL,
    ADD COLUMN gif_metadata JSONB NULL;

CREATE INDEX idx_messages_sticker_id ON messages (sticker_id) WHERE sticker_id IS NOT NULL;
