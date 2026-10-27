-- Badge Espectador: tempo assistindo à transmissão de tela de outra pessoa
-- numa call, gravado pelo tracker do backend (internal/badge) como o
-- stream_seconds do Streamer.
ALTER TABLE user_badge_stats
    ADD COLUMN IF NOT EXISTS watch_seconds BIGINT NOT NULL DEFAULT 0 CHECK (watch_seconds >= 0);
