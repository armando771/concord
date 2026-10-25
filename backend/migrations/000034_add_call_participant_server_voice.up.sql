-- Silenciar/ensurdecer de moderador de quem está na chamada, para sobreviver a
-- um reinício do backend (deploy) como o mudo normal (000030): sem isso um
-- deploy liberaria quem um moderador silenciou.
-- Só acrescenta colunas com padrão: o binário anterior continua funcionando.
ALTER TABLE call_participants
  ADD COLUMN IF NOT EXISTS server_muted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS server_deafened BOOLEAN NOT NULL DEFAULT false;
