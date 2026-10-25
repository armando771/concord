-- Sons da Mesa de Áudio (Soundboard) compartilhados por servidor.
CREATE TABLE soundboard_sounds (
    id UUID PRIMARY KEY,
    server_id UUID NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name VARCHAR(32) NOT NULL,
    emoji VARCHAR(16) NULL,
    content_type VARCHAR(64) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
    duration_ms INT NOT NULL CHECK (duration_ms BETWEEN 100 AND 15000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_soundboard_sounds_server ON soundboard_sounds (server_id, created_at DESC);
