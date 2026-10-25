-- Mudo/ensurdecido e tela de quem está na chamada, para sobreviverem a um
-- reinício do backend (deploy): ícones de mudo e selo LIVE não piscam.
-- Só acrescenta colunas com padrão: o binário anterior continua funcionando.
ALTER TABLE call_participants
  ADD COLUMN IF NOT EXISTS muted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deafened BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS screen_sharing BOOLEAN NOT NULL DEFAULT false;
