-- Badge "Barulhento" (internal/badge, categoria "barulhento"): sons tocados na
-- mesa de áudio de uma call com alguém ouvindo. Nada disso ficava gravado, então
-- todo mundo começa do zero; o backend soma a cada som (internal/call).
ALTER TABLE user_badge_stats
    ADD COLUMN IF NOT EXISTS sounds_played BIGINT NOT NULL DEFAULT 0 CHECK (sounds_played >= 0);
