-- Sons favoritos da mesa de áudio, por usuário (docs/adr/0013-mesa-de-audio-por-servidor.md).
-- O som continua do servidor onde foi enviado; o favorito deixa tocá-lo nas
-- chamadas de qualquer servidor. Som apagado na origem sai daqui junto.
CREATE TABLE soundboard_favorites (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    sound_id UUID NOT NULL REFERENCES soundboard_sounds (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, sound_id)
);

CREATE INDEX idx_soundboard_favorites_sound ON soundboard_favorites (sound_id);
