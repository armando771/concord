-- Estilo do nome de exibição (fonte + efeito + cores), como no Discord.
-- Só acrescenta colunas com padrão: o binário anterior continua funcionando.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS name_font TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS name_effect TEXT NOT NULL DEFAULT 'solid',
  ADD COLUMN IF NOT EXISTS name_colors TEXT[] NOT NULL DEFAULT '{}';
