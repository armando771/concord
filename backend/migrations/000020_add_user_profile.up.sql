-- Perfil como no Discord: pronomes, "Sobre mim", nota (balão ao lado da
-- foto), banner (imagem ou cor), links e o status escolhido pela pessoa.
ALTER TABLE users
  ADD COLUMN pronouns VARCHAR(40) NOT NULL DEFAULT '',
  ADD COLUMN bio VARCHAR(190) NOT NULL DEFAULT '',
  ADD COLUMN status_text VARCHAR(128) NOT NULL DEFAULT '',
  ADD COLUMN banner_url TEXT NULL,
  ADD COLUMN banner_color VARCHAR(7) NULL,
  ADD COLUMN links JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'online'
    CHECK (status IN ('online', 'idle', 'dnd', 'invisible'));
