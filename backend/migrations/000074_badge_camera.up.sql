-- Badge "Câmera ligada" (internal/badge, categoria "camera"): tempo em call
-- com a câmera ligada e mais alguém ouvindo (as regras do Streamer). O backend
-- não sabia quem estava de câmera, então todo mundo começa do zero; o tracker
-- pergunta ao LiveKit a cada tick e grava junto com o resto das calls.
ALTER TABLE user_badge_stats
    ADD COLUMN IF NOT EXISTS camera_seconds BIGINT NOT NULL DEFAULT 0 CHECK (camera_seconds >= 0);
