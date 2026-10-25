-- Anexos de mensagem (fotos, gifs, vídeos, áudios). Nasce "pendente"
-- (message_id NULL) no upload e é ligado à mensagem quando ela é criada.
CREATE TABLE message_attachments (
    id UUID PRIMARY KEY,
    message_id UUID NULL REFERENCES messages (id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES users (id),
    channel_id UUID NULL REFERENCES channels (id) ON DELETE CASCADE,
    conversation_id UUID NULL REFERENCES conversations (id) ON DELETE CASCADE,
    kind VARCHAR(8) NOT NULL CHECK (kind IN ('image', 'video', 'audio')),
    content_type VARCHAR(64) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 26214400),
    width INT NULL CHECK (width > 0),
    height INT NULL CHECK (height > 0),
    duration_ms INT NULL CHECK (duration_ms > 0),
    position SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((channel_id IS NOT NULL) <> (conversation_id IS NOT NULL))
);

CREATE INDEX idx_message_attachments_message ON message_attachments (message_id, position);
CREATE INDEX idx_message_attachments_pending ON message_attachments (created_at) WHERE message_id IS NULL;
