-- Som de entrada: toca para quem está na call quando a pessoa entra.
-- NULL = o som padrão do app.
ALTER TABLE users ADD COLUMN IF NOT EXISTS entrance_sound_url TEXT;
