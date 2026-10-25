-- XP de voz: o nível é calculado a partir do XP (internal/level/curve.go).
CREATE TABLE user_levels (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    xp BIGINT NOT NULL DEFAULT 0 CHECK (xp >= 0),
    voice_seconds BIGINT NOT NULL DEFAULT 0 CHECK (voice_seconds >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_levels_xp ON user_levels (xp DESC);
