-- Figurinhas (Stickers) compartilhadas por servidor.
CREATE TABLE server_stickers (
    id UUID PRIMARY KEY,
    server_id UUID NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name VARCHAR(32) NOT NULL,
    file_id UUID NOT NULL,
    content_type VARCHAR(64) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 1048576), -- até 1 MB
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_server_stickers_server ON server_stickers (server_id, created_at DESC);
