CREATE TABLE channel_pinned_messages (
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    pinned_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (channel_id, message_id)
);

CREATE INDEX idx_pinned_messages_channel_pinned_at
    ON channel_pinned_messages (channel_id, pinned_at DESC);

CREATE INDEX idx_pinned_messages_message
    ON channel_pinned_messages (message_id);
